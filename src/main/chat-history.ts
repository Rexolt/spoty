import * as fs from 'fs';
import { chatHistoryFile, configDir, getConfig } from './config';
import type { ChatEntry } from '../shared/types';

const MAX_ENTRIES = 100;

let chatHistory: ChatEntry[] = [];

export function getChatHistory(): ChatEntry[] {
  if (!getConfig().ai.saveHistory) return [];
  return chatHistory;
}

export function loadChatHistory(): void {
  if (!getConfig().ai.saveHistory) return;
  try {
    if (fs.existsSync(chatHistoryFile)) {
      const data = fs.readFileSync(chatHistoryFile, 'utf8');
      const parsed = JSON.parse(data);
      chatHistory = Array.isArray(parsed) ? (parsed as ChatEntry[]) : [];
      if (chatHistory.length > MAX_ENTRIES) {
        chatHistory = chatHistory.slice(-MAX_ENTRIES);
        saveChatHistory();
      }
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
    chatHistory = [];
  }
}

export function saveChatHistory(): void {
  if (!getConfig().ai.saveHistory) return;
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(chatHistoryFile, JSON.stringify(chatHistory, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
}

export function addChatEntry(prompt: string, reply: string): void {
  if (!getConfig().ai.saveHistory) return;
  chatHistory.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    prompt,
    reply,
    time: new Date().toISOString(),
    provider: getConfig().ai.provider,
  });
  if (chatHistory.length > MAX_ENTRIES) {
    chatHistory.shift();
  }
  saveChatHistory();
}

export function clearChatHistory(): void {
  chatHistory = [];
  saveChatHistory();
}

export function deleteChatEntry(id: string): boolean {
  if (id === '__all__') {
    chatHistory = [];
  } else {
    chatHistory = chatHistory.filter((e) => e.id !== id);
  }
  saveChatHistory();
  return true;
}

export function clearMemoryAndFile(): void {
  chatHistory = [];
  try {
    if (fs.existsSync(chatHistoryFile)) fs.unlinkSync(chatHistoryFile);
  } catch {
    // ignore
  }
}
