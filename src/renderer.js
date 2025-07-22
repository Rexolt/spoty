const { ipcRenderer } = require('electron');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const os = require('os');


const iconContainer = document.getElementById('lottie-icon');
let currentAnimation = null;


function loadMainIcon() {
  if (currentAnimation) {
    currentAnimation.destroy();
  }
  currentAnimation = lottie.loadAnimation({
    container: iconContainer,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: 'wired-flat-19-magnifier-zoom-search-morph-cross.json'
  });
}


function findIconPath(iconName) {
  if (!iconName) return null;
  const iconDirs = [
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/hicolor/256x256/apps',
    '/usr/share/icons/hicolor/64x64/apps',
    '/usr/share/pixmaps',
    '/usr/share/icons/hicolor/scalable/apps'
  ];
  const exts = ['png', 'svg', 'xpm', 'jpg'];

  if (path.isAbsolute(iconName)) {
    if (fs.existsSync(iconName)) return iconName;
    for (const ext of exts) {
      const p = `${iconName}.${ext}`;
      if (fs.existsSync(p)) return p;
    }
  }

  for (const dir of iconDirs) {
    for (const ext of exts) {
      const full = path.join(dir, `${iconName}.${ext}`);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
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
      if (!file.endsWith('.desktop')) return;
      const full = path.join(dir, file);
      const content = fs.readFileSync(full, 'utf-8');
      const nameMatch = content.match(/^Name=(.+)$/m);
      if (nameMatch) {
        const iconMatch = content.match(/^Icon=(.+)$/m);
        const iconPath = iconMatch ? findIconPath(iconMatch[1]) : null;
        apps.push({ name: nameMatch[1], path: full, icon: iconPath });
      }
    });
  });
  return apps;
}

const appItems = loadApplications();
const fuse = new Fuse(appItems, { keys: ['name'], threshold: 0.3 });

const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');
const baseHeight = 80;

function adjustHeight() {
  const resultsHeight = resultsDiv.scrollHeight;
  const total = Math.min(baseHeight + resultsHeight, 400);
  ipcRenderer.send('adjust-height', total);
}

function parseWebQuery(q) {
  const m = q.trim().match(/^web:\s*(.+)$/i);
  return m ? m[1] : null;
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  resultsDiv.innerHTML = '';

  if (query) {
    const web = parseWebQuery(query);
    if (!web) {
      const results = fuse.search(query).slice(0, 20);
      if (results.length === 0) {
        const el = document.createElement('div');
        el.className = 'result-item no-results';
        el.textContent = 'Nincs találat';
        resultsDiv.appendChild(el);
        
        if (currentAnimation && currentAnimation.path === 'wired-flat-19-magnifier-zoom-search-morph-cross.json') {
          currentAnimation.goToAndPlay(0, true);
        }
      } else {
        results.forEach(({ item }, index) => {
          const el = document.createElement('div');
          el.className = 'result-item';
          el.style.animationDelay = `${index * 30}ms`;

          
          if (item.icon) {
            const img = document.createElement('img');
            img.src = `file://${item.icon}`;
            img.className = 'result-icon';
            el.appendChild(img);
          }
          
          const span = document.createElement('span');
          span.textContent = item.name;
          el.appendChild(span);

          el.onclick = () => ipcRenderer.send('launch-item', item.path);
          resultsDiv.appendChild(el);
        });
      }
    }
  }
  adjustHeight();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('hide-window');
  } else if (e.key === 'Enter') {
    const web = parseWebQuery(searchInput.value);
    if (web) {
      const url = `https://duckduckgo.com/?q=${encodeURIComponent(web)}`;
      ipcRenderer.send('open-url', url);
    } else {
      const first = resultsDiv.querySelector('.result-item:not(.no-results)');
      if (first) first.click();
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  searchInput.focus();
  adjustHeight();
});

ipcRenderer.on('focus-search', () => {
  searchInput.focus();
  if (currentAnimation) {
    currentAnimation.destroy();
  }
  

  currentAnimation = lottie.loadAnimation({
    container: iconContainer,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    path: 'animation.json'
  });


  currentAnimation.addEventListener('complete', loadMainIcon);
});

ipcRenderer.on('reset-search', () => {
  searchInput.value = '';
  resultsDiv.innerHTML = '';
  if (currentAnimation) {
    currentAnimation.destroy();
    currentAnimation = null;
  }
  adjustHeight();
});