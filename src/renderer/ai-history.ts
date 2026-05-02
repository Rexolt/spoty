import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict } from './i18n';
import { escapeHtml } from './utils';
import { updateWindowSize } from './window-size';
import { clearResults } from './search-results';
import { renderChatMessages, showAiHistoryHint } from './ai-chat';
import type { ChatEntry } from '../shared/types';

export async function openAiHistory(): Promise<void> {
  const dict = getDict(state.appSettings?.language);
  let history: ChatEntry[] = [];
  try {
    history = await api.invoke('get-chat-history');
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }

  dom.footer.style.display = 'none';

  if (!history || history.length === 0) {
    dom.resultsContainer.innerHTML = `
      <div class="ai-history-panel ai-history-empty fade-in">
        <div class="ai-history-empty-text">${dict.ai_history_empty}</div>
        <button class="ai-history-btn" data-action="close-ai-history">${dict.ai_history_back}</button>
      </div>
    `;
    updateWindowSize();
    return;
  }

  const reversed = [...history].reverse();
  let html = '<div class="ai-history-panel fade-in">';
  html += `<div class="ai-history-toolbar">`;
  html += `<button class="ai-history-btn" data-action="close-ai-history">${dict.ai_history_back}</button>`;
  html += `<button class="ai-history-btn danger" data-action="delete-all-history">${dict.ai_history_delete_all}</button>`;
  html += `</div>`;

  const locale = state.appSettings?.language === 'en' ? 'en-US' : 'hu-HU';

  for (const entry of reversed) {
    const date = new Date(entry.time);
    const timeStr = date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const promptPreview =
      escapeHtml(entry.prompt.substring(0, 60)) + (entry.prompt.length > 60 ? '...' : '');
    const replyPreview =
      escapeHtml(entry.reply.substring(0, 80)) + (entry.reply.length > 80 ? '...' : '');

    html += `
      <div class="result-item history-entry" data-action="view-history" data-id="${entry.id}">
        <div class="history-entry-header">
          <div class="result-title history-entry-title">${promptPreview}</div>
          <div class="history-entry-meta">
            <span class="history-entry-time">${timeStr}</span>
            <button class="history-delete-btn" data-action="delete-history" data-id="${entry.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div class="result-desc history-entry-preview">${replyPreview}</div>
      </div>
    `;
  }
  html += '</div>';
  dom.resultsContainer.innerHTML = html;
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
