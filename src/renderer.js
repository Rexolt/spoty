const { ipcRenderer } = require('electron');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const os = require('os');


function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push({ name: entry.name, path: fullPath });
    }
  }
  return fileList;
}


function loadApplications() {
  const appsDirs = [
    '/usr/share/applications',
    path.join(os.homedir(), '.local/share/applications')
  ];
  const apps = [];
  appsDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith('.desktop')) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const match = content.match(/^Name=(.+)$/m);
        if (match) {
          apps.push({ name: match[1], path: path.join(dir, file) });
        }
      }
    });
  });
  return apps;
}

// Prepare data
const fileItems = walkDir(os.homedir()); 
const appItems = loadApplications();
const data = [...appItems, ...fileItems];


const fuse = new Fuse(data, { keys: ['name'], threshold: 0.3 });

const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  if (query) searchInput.classList.add('not-empty');
  else searchInput.classList.remove('not-empty');
  resultsDiv.innerHTML = '';
  if (query) {
    const results = fuse.search(query).slice(0, 20);
    results.forEach(({ item }) => {
      const el = document.createElement('div');
      el.className = 'result-item';
      el.textContent = item.name;
      el.onclick = () => {
        ipcRenderer.send('launch-item', item.path);
      };
      resultsDiv.appendChild(el);
    });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('hide-window');
  }
});
