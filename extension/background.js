console.log("Rabbit Hole Ramp background worker running");

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    console.log("Tab switched to:", tab.url);
  });
});