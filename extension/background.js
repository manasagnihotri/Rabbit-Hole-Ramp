const DRIFT_DOMAINS = [
    "reddit.com", "youtube.com", "twitter.com", "x.com",
    "instagram.com", "facebook.com", "tiktok.com", "netflix.com",
    "twitch.tv", "buzzfeed.com", "9gag.com"
  ];
  
  const WORK_DOMAINS = [
    "github.com", "stackoverflow.com", "docs.google.com", "notion.so",
    "figma.com", "linear.app", "jira.atlassian.com", "google.com",
    "localhost", "anthropic.com", "openai.com"
  ];
  
  function classifyDomain(url) {
    if (!url || url.startsWith("chrome://")) return "neutral";
    const hostname = new URL(url).hostname.replace("www.", "");
    if (DRIFT_DOMAINS.some(d => hostname.includes(d))) return "drift";
    if (WORK_DOMAINS.some(d => hostname.includes(d))) return "work";
    return "neutral";
  }
  
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (!tab.url) return;
      const entry = {
        url: tab.url,
        title: tab.title,
        domain: new URL(tab.url).hostname,
        type: classifyDomain(tab.url),
        timestamp: Date.now()
      };
      chrome.storage.local.get({ tabHistory: [] }, (result) => {
        const history = result.tabHistory;
        history.push(entry);
        if (history.length > 100) history.shift(); // keep last 100
        chrome.storage.local.set({ tabHistory: history });
        console.log("Tab tracked:", entry.type, entry.domain);
      });
    });
  });