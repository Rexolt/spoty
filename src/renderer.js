const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const clearButton = document.getElementById('clear-btn');

let currentResults = [];
let selectedIndex = -1;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  searchInput.focus();
  setupEventListeners();
});

function setupEventListeners() {
  searchInput.addEventListener('input', handleSearchInput);
  
  clearButton.addEventListener('click', clearSearch);
  
  document.addEventListener('keydown', handleKeyPress);
  
  
  window.electron.on('window-show', () => {
    searchInput.focus();
    searchInput.select();
  });
  
  window.electron.on('window-hide', () => {
    clearSearch();
  });
}

function handleSearchInput(e) {
  const query = e.target.value;
  
  clearButton.style.display = query ? 'block' : 'none';
  
  clearTimeout(searchTimeout);
  
  if (!query) {
    clearResults();
    return;
  }
  
  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 200);
}

async function performSearch(query) {
  try {
    const results = await window.electron.invoke('search', query);
    currentResults = results || [];
    renderResults(currentResults);
  } catch (error) {
    console.error('Search error:', error);
    currentResults = [];
    renderResults([]);
  }
}

function renderResults(results) {
  resultsContainer.innerHTML = '';
  selectedIndex = -1;
  
  if (results.length === 0) {
    if (searchInput.value) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">Nincs találat</div>
        </div>
      `;
    }
    updateWindowSize();
    return;
  }
  
  results.forEach((item, index) => {
    const element = createResultElement(item, index);
    resultsContainer.appendChild(element);
  });
  
  updateWindowSize();
}

function createResultElement(item, index) {
  const div = document.createElement('div');
  div.className = 'result-item';
  div.dataset.index = index;
  
  // Ikon
  const icon = document.createElement('div');
  icon.className = 'result-icon';
  
  if (item.type === 'calc') {
    icon.innerHTML = '🧮';
  } else if (item.type === 'command') {
    icon.innerHTML = '⚡';
  } else if (item.type === 'clipboard') {
    icon.innerHTML = '📋';
  } else if (item.type === 'file') {
    icon.innerHTML = '📄';
  } else if (item.iconPath) {
    const img = document.createElement('img');
    img.src = `file://${item.iconPath}`;
    img.onerror = () => {
      icon.innerHTML = '📦';
    };
    icon.appendChild(img);
  } else {
    icon.innerHTML = '📦';
    loadIcon(item.icon).then(path => {
      if (path) {
        const img = document.createElement('img');
        img.src = `file://${path}`;
        icon.innerHTML = '';
        icon.appendChild(img);
      }
    });
  }
  
  const content = document.createElement('div');
  content.className = 'result-content';
  
  const title = document.createElement('div');
  title.className = 'result-title';
  title.textContent = item.name;
  
  const desc = document.createElement('div');
  desc.className = 'result-desc';
  desc.textContent = item.description || '';
  
  content.appendChild(title);
  if (item.description) {
    content.appendChild(desc);
  }
  
  div.appendChild(icon);
  div.appendChild(content);
  
  div.addEventListener('click', () => executeItem(item));
  
  div.addEventListener('mouseenter', () => selectItem(index));
  
  return div;
}

async function loadIcon(iconName) {
  if (!iconName) return null;
  try {
    return await window.electron.invoke('get-icon', iconName);
  } catch (e) {
    return null;
  }
}

function executeItem(item) {
  switch (item.type) {
    case 'app':
      window.electron.send('app-launch', item.path);
      break;
    case 'file':
      window.electron.send('app-launch', item.path);
      break;
    case 'command':
      window.electron.send('command-run', item.command);
      break;
    case 'calc':
    case 'clipboard':
      window.electron.send('clipboard-copy', item.value || item.name);
      break;
  }
}

function selectItem(index) {
  const items = resultsContainer.querySelectorAll('.result-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  selectedIndex = index;
}

function handleKeyPress(e) {
  switch (e.key) {
    case 'Escape':
      if (searchInput.value) {
        clearSearch();
      } else {
        window.electron.send('window-hide');
      }
      break;
      
    case 'Enter':
      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        executeItem(currentResults[selectedIndex]);
      } else if (currentResults.length > 0) {
        executeItem(currentResults[0]);
      }
      break;
      
    case 'ArrowDown':
      e.preventDefault();
      if (currentResults.length > 0) {
        selectItem(Math.min(selectedIndex + 1, currentResults.length - 1));
      }
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      if (currentResults.length > 0) {
        selectItem(Math.max(selectedIndex - 1, 0));
      }
      break;
      
    case 'Tab':
      e.preventDefault();
      if (currentResults.length > 0) {
        if (e.shiftKey) {
          selectItem(selectedIndex > 0 ? selectedIndex - 1 : currentResults.length - 1);
        } else {
          selectItem(selectedIndex < currentResults.length - 1 ? selectedIndex + 1 : 0);
        }
      }
      break;
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
    const index = parseInt(e.key) - 1;
    if (currentResults[index]) {
      executeItem(currentResults[index]);
    }
  }
}

function clearSearch() {
  searchInput.value = '';
  clearButton.style.display = 'none';
  clearResults();
  searchInput.focus();
}

function clearResults() {
  currentResults = [];
  selectedIndex = -1;
  resultsContainer.innerHTML = '';
  updateWindowSize();
}

function updateWindowSize() {
  setTimeout(() => {
    const searchHeight = 60;
    const resultsHeight = resultsContainer.scrollHeight || 0;
    const padding = resultsHeight > 0 ? 10 : 0;
    const totalHeight = searchHeight + resultsHeight + padding;
    
    window.electron.send('window-resize', totalHeight);
  }, 10);
}