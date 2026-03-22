// popup.js

console.log('[RHR] Popup loaded');

// --- Helpers ---
function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} hr ago`;
}

function formatDriftStats(driftStats) {
  if (!driftStats || !driftStats.totalMs) return '';
  const mins = Math.floor(driftStats.totalMs / 60000);
  if (mins < 1) return '';
  return `${mins} min on social media today`;
}

// --- Restore My Flow ---
async function restoreFlow(workTabs) {
  // Close all open drift/social media tabs
  const allTabs = await chrome.tabs.query({});
  const DRIFT_DOMAINS = [
    'reddit.com', 'youtube.com', 'twitter.com', 'x.com', 'instagram.com',
    'tiktok.com', 'facebook.com', 'twitch.tv', 'news.ycombinator.com',
    'buzzfeed.com', 'tumblr.com', 'pinterest.com', 'netflix.com'
  ];

  const driftTabIds = allTabs
    .filter(t => {
      try {
        const domain = new URL(t.url).hostname;
        return DRIFT_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
      } catch { return false; }
    })
    .map(t => t.id);

  if (driftTabIds.length > 0) {
    await chrome.tabs.remove(driftTabIds);
  }

  // Open work tabs
  for (const tab of workTabs) {
    await chrome.tabs.create({ url: tab.url });
  }

  window.close();
}

// --- Render ---
function renderSnapshot(snapshot) {
  const card = document.createElement('div');
  card.className = 'snapshot-card';

  const summaryEl = document.createElement('div');
  if (snapshot.summary) {
    summaryEl.className = 'summary-text';
    summaryEl.textContent = snapshot.summary;
  } else {
    summaryEl.className = 'fallback-note';
    summaryEl.textContent = 'We saved your tabs but couldn\'t generate a summary.';
  }
  card.appendChild(summaryEl);

  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = `Saved ${timeAgo(snapshot.capturedAt)}`;
  card.appendChild(timestamp);

  const tabList = document.createElement('ul');
  tabList.className = 'work-tabs';
  (snapshot.workTabs || []).forEach(tab => {
    const li = document.createElement('li');
    li.textContent = tab.title || tab.url;
    li.title = tab.url;
    tabList.appendChild(li);
  });
  card.appendChild(tabList);

  const btn = document.createElement('button');
  btn.className = 'restore-btn';
  btn.textContent = 'Restore My Flow';
  btn.addEventListener('click', () => restoreFlow(snapshot.workTabs || []));
  card.appendChild(btn);

  return card;
}

function renderHistoryItem(snapshot) {
  const item = document.createElement('div');
  item.className = 'history-item';

  const header = document.createElement('div');
  header.className = 'history-item-header';
  header.innerHTML = `
    <span class="history-item-time">${timeAgo(snapshot.capturedAt)}</span>
    <span class="history-item-trigger">↳ ${snapshot.driftTrigger || 'unknown'}</span>
  `;

  const body = document.createElement('div');
  body.className = 'history-item-body';
  body.textContent = snapshot.summary || 'No summary available.';

  header.addEventListener('click', () => body.classList.toggle('open'));

  item.appendChild(header);
  item.appendChild(body);
  return item;
}

function renderEmptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <span class="emoji">🐇</span>
    No rabbit holes detected yet.<br/>Go do your best work — we'll be here when you need us.
  `;
  return el;
}

// --- Init ---
async function init() {
  const app = document.getElementById('app');
  const driftStatsEl = document.getElementById('driftStats');

  const data = await chrome.storage.local.get(['snapshots', 'driftStats']);
  const snapshots = (data.snapshots || []).slice().reverse(); // newest first
  const driftStats = data.driftStats || null;

  // Drift stats in header
  const statsText = formatDriftStats(driftStats);
  if (statsText) driftStatsEl.textContent = statsText;

  if (snapshots.length === 0) {
    app.appendChild(renderEmptyState());
    return;
  }

  // Most recent snapshot as main card
  app.appendChild(renderSnapshot(snapshots[0]));

  // Session history (older snapshots)
  if (snapshots.length > 1) {
    const historySection = document.createElement('div');
    historySection.className = 'history-section';

    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = 'Earlier today';
    historySection.appendChild(title);

    snapshots.slice(1).forEach(s => {
      historySection.appendChild(renderHistoryItem(s));
    });

    app.appendChild(historySection);
  }
}

init();
