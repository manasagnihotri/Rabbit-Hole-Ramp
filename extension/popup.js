function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  
  function showEmptyState() {
    document.getElementById("empty-state").classList.remove("hidden");
    document.getElementById("snapshot-card").classList.add("hidden");
  }
  
  function showSnapshotCard(snapshot) {
    document.getElementById("empty-state").classList.add("hidden");
    document.getElementById("snapshot-card").classList.remove("hidden");
  
    // Summary text
    const summaryEl = document.getElementById("summary-text");
    summaryEl.textContent = snapshot.summary
      ? snapshot.summary
      : "You drifted away from your work tabs. Click below to jump back in.";
  
    // Tab list
    const tabListEl = document.getElementById("tab-list");
    tabListEl.innerHTML = "";
    snapshot.workTabs.slice(0, 4).forEach(tab => {
      const div = document.createElement("div");
      div.className = "tab-item";
      div.textContent = tab.title || tab.url;
      tabListEl.appendChild(div);
    });
  
    // Timestamp
    document.getElementById("timestamp").textContent =
      `Captured ${timeAgo(snapshot.timestamp)}`;
  
    // Restore button
    document.getElementById("restore-btn").onclick = () => {
      snapshot.workTabs.forEach(tab => {
        chrome.tabs.create({ url: tab.url });
      });
      window.close();
    };
  }
  
  // Load latest snapshot + time log
chrome.storage.local.get({ snapshots: [], timeLog: {} }, (result) => {
    const snapshots = result.snapshots;
    if (snapshots.length === 0) {
      showEmptyState();
    } else {
      const latest = snapshots[snapshots.length - 1];
      showSnapshotCard(latest);
    }
  
    // Show time stats
    const timeLog = result.timeLog;
    const entries = Object.entries(timeLog)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  
    if (entries.length > 0) {
      const statsEl = document.createElement("div");
      statsEl.className = "time-stats";
      statsEl.innerHTML = `
        <div class="stats-label">⏱ Time spent today</div>
        ${entries.map(([domain, secs]) => `
          <div class="stat-row">
            <span class="stat-domain">${domain}</span>
            <span class="stat-time">${secs < 60 ? secs + 's' : Math.round(secs/60) + 'm'}</span>
          </div>
        `).join("")}
      `;
      document.getElementById("app").appendChild(statsEl);
    }
  });