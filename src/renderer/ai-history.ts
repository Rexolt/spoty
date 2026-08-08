import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict } from './i18n';
import { updateWindowSize } from './window-size';
import { clearResults } from './search-results';
import { renderChatMessages, showAiHistoryHint } from './ai-chat';
import type { ChatEntry } from '../shared/types';

/**
 * Like the chat view, this panel is assembled from DOM nodes: stored prompts
 * and replies are attacker-influenced text (whatever the model returned) and
 * must never reach an `innerHTML` sink.
 */

const PROMPT_PREVIEW_LENGTH = 60;
const REPLY_PREVIEW_LENGTH = 80;

function preview(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function createToolbarButton(
  action: string,
  label: string,
  extraClass = ''
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `ai-history-btn${extraClass ? ` ${extraClass}` : ''}`;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createDeleteButton(id: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'history-delete-btn';
  button.dataset.action = 'delete-history';
  button.dataset.id = id;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  for (const [x1, y1, x2, y2] of [
    ['18', '6', '6', '18'],
    ['6', '6', '18', '18'],
  ]) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    svg.appendChild(line);
  }
  button.appendChild(svg);
  return button;
}

function createEntry(entry: ChatEntry, locale: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'result-item history-entry';
  row.dataset.action = 'view-history';
  row.dataset.id = entry.id;

  const header = document.createElement('div');
  header.className = 'history-entry-header';

  const title = document.createElement('div');
  title.className = 'result-title history-entry-title';
  title.textContent = preview(entry.prompt, PROMPT_PREVIEW_LENGTH);
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'history-entry-meta';
  const time = document.createElement('span');
  time.className = 'history-entry-time';
  const parsed = new Date(entry.time);
  time.textContent = Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  meta.appendChild(time);
  meta.appendChild(createDeleteButton(entry.id));
  header.appendChild(meta);
  row.appendChild(header);

  const replyPreview = document.createElement('div');
  replyPreview.className = 'result-desc history-entry-preview';
  replyPreview.textContent = preview(entry.reply, REPLY_PREVIEW_LENGTH);
  row.appendChild(replyPreview);

  return row;
}

export async function openAiHistory(): Promise<void> {
  const dict = getDict(state.appSettings?.language);
  let history: ChatEntry[] = [];
  try {
    history = await api.invoke('get-chat-history');
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }

  dom.footer.style.display = 'none';

  const panel = document.createElement('div');

  if (!history || history.length === 0) {
    panel.className = 'ai-history-panel ai-history-empty fade-in';
    const empty = document.createElement('div');
    empty.className = 'ai-history-empty-text';
    empty.textContent = dict.ai_history_empty;
    panel.appendChild(empty);
    panel.appendChild(createToolbarButton('close-ai-history', dict.ai_history_back));
    dom.resultsContainer.replaceChildren(panel);
    updateWindowSize();
    return;
  }

  panel.className = 'ai-history-panel fade-in';
  const toolbar = document.createElement('div');
  toolbar.className = 'ai-history-toolbar';
  toolbar.appendChild(createToolbarButton('close-ai-history', dict.ai_history_back));
  toolbar.appendChild(
    createToolbarButton('delete-all-history', dict.ai_history_delete_all, 'danger')
  );
  panel.appendChild(toolbar);

  const locale = state.appSettings?.language === 'en' ? 'en-US' : 'hu-HU';
  for (const entry of [...history].reverse()) {
    panel.appendChild(createEntry(entry, locale));
  }

  dom.resultsContainer.replaceChildren(panel);
  updateWindowSize();
}

export async function viewHistoryEntry(id: string): Promise<void> {
  let history: ChatEntry[] = [];
  try {
    history = await api.invoke('get-chat-history');
  } catch {
    return;
  }
  const entry = history.find((e) => e.id === id);
  if (!entry) return;

  dom.searchInput.value = entry.prompt;
  dom.clearButton.style.display = 'flex';

  state.chatDisplayMessages = [
    { role: 'user', content: entry.prompt },
    { role: 'assistant', content: entry.reply },
  ];
  renderChatMessages(false);
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  try {
    await api.invoke('delete-chat-history', id);
    void openAiHistory();
  } catch (e) {
    console.error('Failed to delete:', e);
  }
}

export async function deleteAllHistory(): Promise<void> {
  try {
    await api.invoke('delete-chat-history', '__all__');
    void openAiHistory();
  } catch (e) {
    console.error('Failed to delete all:', e);
  }
}

export function closeAiHistory(): void {
  clearResults();
  if (state.isAiMode && state.appSettings?.ai?.saveHistory) {
    showAiHistoryHint();
  }
}
