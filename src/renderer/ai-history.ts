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
      <div class="ai-history-panel fade-in" style="padding: 16px; text-align: center;">
        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${dict.ai_history_empty}</div>
        <button class="ai-history-btn" data-action="close-ai-history" style="
          background: var(--selection-bg);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        ">${dict.ai_history_back}</button>
      </div>
    `;
    updateWindowSize();
    return;
  }

  const reversed = [...history].reverse();
  let html = '<div class="ai-history-panel fade-in" style="padding: 8px;">';
  html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 8px;">`;
  html += `<button class="ai-history-btn" data-action="close-ai-history" style="
    background: var(--selection-bg); border: 1px solid var(--border-color); color: var(--text-main);
    padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
  ">${dict.ai_history_back}</button>`;
  html += `<button class="ai-history-btn" data-action="delete-all-history" style="
    background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.2); color: #ff4444;
    padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
  ">${dict.ai_history_delete_all}</button>`;
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
      <div class="result-item history-entry" style="cursor: pointer; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 14px;" data-action="view-history" data-id="${entry.id}">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="result-title" style="font-size: 14px;">${promptPreview}</div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 10px; color: var(--text-muted);">${timeStr}</span>
            <button class="history-delete-btn" data-action="delete-history" data-id="${entry.id}" style="
              background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
              font-size: 11px; opacity: 0.6; transition: opacity 0.2s, color 0.2s;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div class="result-desc" style="font-size: 12px; white-space: normal; line-height: 1.4;">${replyPreview}</div>
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
