import type { Theme } from '../shared/types';

const THEMES: Theme[] = ['dark', 'light', 'ocean', 'forest', 'midnight'];

export function applyTheme(theme: Theme): void {
  for (const t of THEMES) document.body.classList.remove(`theme-${t}`);
  document.body.classList.add(`theme-${theme}`);
}
