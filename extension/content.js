// content.js — content script

console.log('[RHR] Content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'extractContent') return;

  try {
    const title = document.title || '';

    // Get visible text, fall back to title if body is empty (e.g. iframes like Google Docs)
    let snippet = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!snippet) snippet = title;

    console.log(`[RHR] Extracted content: "${snippet.slice(0, 60)}..."`);
    sendResponse({ title, snippet });
  } catch (err) {
    console.error('[RHR] extractContent error:', err);
    sendResponse({ title: document.title || '', snippet: '' });
  }

  return true; // keep message channel open for async sendResponse
});
