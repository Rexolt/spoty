import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict } from './i18n';
import { escapeHtml } from './utils';
import { updateWindowSize } from './window-size';
import { clearResults } from './search-results';

export function renderChatMessages(showLoading = false): void {
  const dict = getDict(state.appSettings?.language);
  dom.footer.style.display = 'none';

  let html = '<div class="ai-chat-container">';

  for (let i = 0; i < state.chatDisplayMessages.length; i++) {
    const msg = state.chatDisplayMessages[i];
    const isLast = i === state.chatDisplayMessages.length - 1 && !showLoading;

    if (msg.role === 'user') {
      html += `
        <div class="ai-user-bubble ${isLast ? 'ai-msg-enter' : ''}">
          <div class="ai-user-text">${escapeHtml(msg.content)}</div>
        </div>`;
    } else {
      const isError = msg.isError === true;
      const htmlText = isError
        ? escapeHtml(msg.content).replace(/\n/g, '<br/>')
        : DOMPurify.sanitize(marked.parse(msg.content));

      html += `
        <div class="ai-chat-card ${isLast ? 'ai-response-arrive' : ''} ${isError ? 'error' : ''}">
          <div class="ai-avatar">${isError ? '⚠️' : 'AI'}</div>
          <div class="ai-content">
            <div class="ai-text">${htmlText}</div>
            ${
              !isError
                ? `
            <button class="ai-copy-btn" data-action="copy-ai" data-text="${escapeHtml(msg.content)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> ${dict.copy}
            </button>`
                : ''
            }
          </div>
        </div>`;
    }
  }

  if (showLoading) {
    html += `
      <div class="ai-chat-card loading">
        <div class="ai-avatar">AI</div>
        <div class="ai-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>`;
  }
  html += '</div>';
  dom.resultsContainer.innerHTML = html;

  const chatContainer = dom.resultsContainer.querySelector('.ai-chat-container');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  updateWindowSize();
}

export async function startAiChat(query: string): Promise<void> {
  if (!query.trim()) return;

  state.chatDisplayMessages.push({ role: 'user', content: query });
  dom.searchInput.value = '';
  dom.clearButton.style.display = 'none';
  renderChatMessages(true);

  try {
    const reply = await api.invoke('ask-ai', query);
    state.chatDisplayMessages.push({ role: 'assistant', content: reply });
    renderChatMessages(false);
  } catch (err) {
    const dict = getDict(state.appSettings?.language);
    state.chatDisplayMessages.push({
      role: 'assistant',
      content: `${dict.ai_error}: ${(err as Error).message}`,
      isError: true,
    });
    renderChatMessages(false);
  }
}

export function copyAiText(btn: HTMLElement): void {
  const text = btn.getAttribute('data-text') || '';
  api.send('clipboard-copy', text);
  const originalHtml = btn.innerHTML;
  const dict = getDict(state.appSettings?.language);
  btn.innerHTML = dict.copied;
  setTimeout(() => {
    btn.innerHTML = originalHtml;
  }, 2000);
}

export function showAiHistoryHint(): void {
  if (!state.appSettings?.ai?.saveHistory) return;
  const dict = getDict(state.appSettings?.language);
  dom.footer.style.display = 'none';
  dom.resultsContainer.innerHTML = `
    <div class="ai-history-hint fade-in">
      <button class="ai-history-btn primary" data-action="open-ai-history">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${dict.ai_history_title}
      </button>
    </div>
  `;
  updateWindowSize();
}

export function resetAiContext(): void {
  api.send('reset-ai-context');
  state.chatDisplayMessages = [];
  dom.searchInput.value = '';
  dom.clearButton.style.display = 'none';
  clearResults();

  const dict = getDict(state.appSettings?.language);
  dom.resultsContainer.innerHTML = `
    <div class="ai-reset-hint fade-in">
      <div class="ai-reset-hint-card">✨ ${dict.ai_new_chat}</div>
    </div>
  `;
  updateWindowSize();

  setTimeout(() => {
    if (state.isAiMode && state.appSettings?.ai?.saveHistory) {
      showAiHistoryHint();
    } else {
      clearResults();
    }
  }, 1200);
}
