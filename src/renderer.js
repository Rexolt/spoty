const { ipcRenderer } = require('electron');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const os = require('os');


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

// Prepare data
const appItems = loadApplications();
const data = appItems;


const fuse = new Fuse(data, { keys: ['name'], threshold: 0.3 });

const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');
const baseHeight = 60;

function adjustHeight() {
  const resultsHeight = resultsDiv.scrollHeight;
  const total = Math.min(baseHeight + resultsHeight, 350);
  ipcRenderer.send('adjust-height', total);
}

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

      if (item.icon) {
        const img = document.createElement('img');
        img.src = `file://${item.icon}`;
        img.className = 'result-icon';
        el.appendChild(img);
      }

      const span = document.createElement('span');
      span.textContent = item.name;
      el.appendChild(span);

      el.onclick = () => {
        ipcRenderer.send('launch-item', item.path);
      };

      resultsDiv.appendChild(el);
    });
  }
  adjustHeight();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('hide-window');
  } else if (e.key === 'Enter') {
    const first = resultsDiv.querySelector('.result-item');
    if (first) first.click();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  adjustHeight();
});
