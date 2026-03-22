const DRIFT_DOMAINS = [
    "reddit.com", "youtube.com", "twitter.com", "x.com",
    "instagram.com", "facebook.com", "tiktok.com", "netflix.com",
    "twitch.tv", "buzzfeed.com", "9gag.com"
  ];
  
  const WORK_DOMAINS = [
    "github.com", "stackoverflow.com", "docs.google.com", "notion.so",
    "figma.com", "linear.app", "jira.atlassian.com", "google.com",
    "localhost", "anthropic.com", "openai.com", "scikit-learn.org"
  ];
  
  const DRIFT_THRESHOLD_SECONDS = 30; // use 30s for demo
  
  function classifyDomain(url) {
    if (!url || url.startsWith("chrome://")) return "neutral";
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      if (DRIFT_DOMAINS.some(d => hostname.includes(d))) return "drift";
      if (WORK_DOMAINS.some(d => hostname.includes(d))) return "work";
      return "neutral";
    } catch { return "neutral"; }
  }
  
  let currentPhase = "work"; // "work" or "drift"
  let driftStartTime = null;
  let workTabsSnapshot = [];
  
  function captureWorkTabs(callback) {
    chrome.tabs.query({}, (tabs) => {
      const workTabs = tabs.filter(t => {
        if (!t.url) return false;
        const type = classifyDomain(t.url);
        return type === "work" || type === "neutral";
      }).map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        domain: (() => { try { return new URL(t.url).hostname; } catch { return ""; } })()
      }));
      callback(workTabs);
    });
  }
  
  function triggerSnapshot() {
    captureWorkTabs((workTabs) => {
      const snapshot = {
        id: Date.now(),
        timestamp: Date.now(),
        workTabs: workTabs,
        summary: null // will be filled by backend later
      };
      chrome.storage.local.get({ snapshots: [] }, (result) => {
        const snapshots = result.snapshots;
        snapshots.push(snapshot);
        chrome.storage.local.set({ snapshots }, () => {
          console.log("Snapshot saved! Work tabs:", workTabs.length);
        });
      });
    });
  }
  
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (!tab.url) return;
  
      const type = classifyDomain(tab.url);
      const entry = {
        url: tab.url,
        title: tab.title,
        domain: (() => { try { return new URL(tab.url).hostname; } catch { return ""; } })(),
        type,
        timestamp: Date.now()
      };
  
      // Save to tab history
      chrome.storage.local.get({ tabHistory: [] }, (result) => {
        const history = result.tabHistory;
        history.push(entry);
        if (history.length > 100) history.shift();
        chrome.storage.local.set({ tabHistory: history });
      });
  
      console.log("Tab tracked:", type, entry.domain);
  
      // Phase transition logic
      if (type === "work") {
        currentPhase = "work";
        driftStartTime = null;
        chrome.alarms.clear("driftAlarm");
      } else if (type === "drift") {
        if (currentPhase === "work") {
          // Just entered drift — start the clock
          currentPhase = "drift";
          driftStartTime = Date.now();
          chrome.alarms.create("driftAlarm", { delayInMinutes: DRIFT_THRESHOLD_SECONDS / 60 });
          console.log("Drift detected! Alarm set for", DRIFT_THRESHOLD_SECONDS, "seconds");
        }
      }
    });
  });
  
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "driftAlarm") {
      console.log("Drift threshold hit! Taking snapshot...");
      triggerSnapshot();
    }
  });