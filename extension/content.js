chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getPageSnippet") {
      const title = document.title;
      const url = window.location.href;
  
      // Grab first 500 chars of visible body text
      const bodyText = document.body
        ? document.body.innerText.slice(0, 500).replace(/\s+/g, " ").trim()
        : "";
  
      sendResponse({ title, url, snippet: bodyText });
    }
    return true; // keep message channel open for async
  });