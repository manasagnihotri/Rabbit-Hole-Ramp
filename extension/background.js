// background.js — service worker

console.log('[RHR] Background service worker loaded');

// --- Constants ---
const WORK_DOMAINS = [
  'docs.google.com', 'github.com', 'stackoverflow.com', 'arxiv.org',
  'localhost', 'kaggle.com', 'colab.research.google.com', 'notion.so',
  'linear.app', 'figma.com', 'atlassian.net', 'trello.com',
  'drive.google.com', 'sheets.google.com', 'slides.google.com',
  'jupyter.org', 'medium.com', 'wikipedia.org'
];

const DRIFT_DOMAINS = [
  'reddit.com', 'youtube.com', 'twitter.com', 'x.com', 'instagram.com',
  'tiktok.com', 'facebook.com', 'twitch.tv', 'news.ycombinator.com',
  'buzzfeed.com', 'tumblr.com', 'pinterest.com', 'netflix.com'
];

const MAX_HISTORY = 100;
const SNAPSHOT_WORK_TABS = 5;
const MIN_DWELL_MS = 10 * 1000;                  // 10 seconds
const DRIFT_NOTIFY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes — cumulative doomscroll check-in
const BACKEND_URL = 'http://localhost:8000/summarize';
const FETCH_TIMEOUT_MS = 10 * 1000;              // 10 seconds

// ⚠️ DEV: 30 seconds. Change to 3.0 before demo.
const DRIFT_THRESHOLD_MINUTES = 0.5;

// --- In-memory state (persisted to storage for service worker survival) ---
let activeTab = null; // { tabId, url, title, domain, startTime }

// --- Helpers ---
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function classifyDomain(domain) {
  if (WORK_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return 'work';
  if (DRIFT_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return 'drift';
  return 'unknown';
}

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// --- Tab Recording ---
async function saveTabRecord(entry) {
  try {
    const data = await chrome.storage.local.get('tabHistory');
    const history = data.tabHistory || [];
    history.push({
      url: entry.url,
      title: entry.title,
      domain: entry.domain,
      type: classifyDomain(entry.domain),
      timestamp: entry.startTime,
      duration: entry.duration
    });
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    await chrome.storage.local.set({ tabHistory: history });
    console.log(`[RHR] Saved: ${entry.domain} (${Math.round(entry.duration / 1000)}s)`);
  } catch (err) {
    console.error('[RHR] saveTabRecord error:', err);
  }
}

// --- Drift Time Accumulation ---
async function accumulateDriftTime(durationMs) {
  try {
    const data = await chrome.storage.local.get('driftStats');
    let stats = data.driftStats || { date: todayString(), totalMs: 0, lastNotifiedInterval: 0 };

    if (stats.date !== todayString()) {
      stats = { date: todayString(), totalMs: 0, lastNotifiedInterval: 0 };
    }

    stats.totalMs += durationMs;

    const currentInterval = Math.floor(stats.totalMs / DRIFT_NOTIFY_INTERVAL_MS);
    if (currentInterval > stats.lastNotifiedInterval) {
      const totalMinutes = Math.floor(stats.totalMs / 60000);
      chrome.notifications.create(`drift-stats-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '🐇 Doomscrolling Check-in',
        message: `You've spent ${totalMinutes} min on social media today. Your work context is saved — click the extension to climb back out.`
      });
      stats.lastNotifiedInterval = currentInterval;
      console.log(`[RHR] Drift stats notification at ${totalMinutes} min`);
    }

    await chrome.storage.local.set({ driftStats: stats });
  } catch (err) {
    console.error('[RHR] accumulateDriftTime error:', err);
  }
}

// --- Content Extraction ---
async function extractContentFromTab(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ title: '', snippet: '' });
        } else {
          resolve(response);
        }
      });
    } catch {
      resolve({ title: '', snippet: '' });
    }
  });
}

// --- Backend Call ---
async function fetchSummary(workTabs, driftTrigger) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: workTabs, drift_trigger: driftTrigger }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('[RHR] Summary received from backend');
    return data.summary || null;
  } catch (err) {
    console.warn('[RHR] Backend call failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Snapshot Capture ---
async function captureSnapshot() {
  console.log('[RHR] Capturing snapshot...');
  try {
    const data = await chrome.storage.local.get(['snapshots', 'driftState']);
    const driftState = data.driftState || {};

    // Query currently open tabs — capture any non-drift, non-system tab
    const EXCLUDE_DOMAINS = ['mail.google.com', 'calendar.google.com', 'chrome.google.com'];
    const allOpenTabs = await chrome.tabs.query({});
    const liveWorkTabs = allOpenTabs
      .filter(t => {
        if (!t.url) return false;
        if (t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
        const domain = extractDomain(t.url);
        if (EXCLUDE_DOMAINS.includes(domain)) return false;
        return classifyDomain(domain) !== 'drift';
      })
      .slice(0, SNAPSHOT_WORK_TABS);

    // Extract live content from each open work tab
    const workTabs = await Promise.all(
      liveWorkTabs.map(async (tab) => {
        const { title, snippet } = await extractContentFromTab(tab.id);
        return {
          url: tab.url,
          title: title || tab.title || '',
          domain: extractDomain(tab.url),
          snippet
        };
      })
    );

    // Call backend for AI summary (non-blocking — save snapshot immediately)
    const snapshot = {
      id: Date.now(),
      workTabs,
      capturedAt: Date.now(),
      driftTrigger: driftState.driftTrigger || 'unknown',
      summary: null
    };

    const snapshots = data.snapshots || [];
    snapshots.push(snapshot);
    if (snapshots.length > 5) snapshots.splice(0, snapshots.length - 5);
    await chrome.storage.local.set({ snapshots });
    console.log(`[RHR] Snapshot saved with ${workTabs.length} live work tabs`);

    // Fire notification immediately — don't wait for summary
    chrome.notifications.create(`snapshot-${snapshot.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Rabbit Hole Ramp 🐇',
      message: 'You went down a rabbit hole. We saved your way back.'
    });

    // Fetch summary and update snapshot in storage
    const summary = await fetchSummary(workTabs, driftState.driftTrigger || 'unknown');
    snapshot.summary = summary; // null if backend failed — popup shows fallback

    const updatedData = await chrome.storage.local.get('snapshots');
    const updatedSnapshots = updatedData.snapshots || [];
    const idx = updatedSnapshots.findIndex(s => s.id === snapshot.id);
    if (idx !== -1) {
      updatedSnapshots[idx].summary = summary;
      await chrome.storage.local.set({ snapshots: updatedSnapshots });
      console.log('[RHR] Snapshot updated with summary');
    }
  } catch (err) {
    console.error('[RHR] captureSnapshot error:', err);
  }
}

// --- Drift Phase Management ---
async function enterDriftPhase(domain) {
  console.log(`[RHR] Drift detected: ${domain}`);
  const driftState = {
    phase: 'drift',
    driftStartTime: Date.now(),
    driftTrigger: domain
  };
  await chrome.storage.local.set({ driftState });
  chrome.alarms.create('driftCheck', { delayInMinutes: DRIFT_THRESHOLD_MINUTES });
}

async function resetToWorkPhase() {
  console.log('[RHR] Returned to work phase');
  chrome.alarms.clear('driftCheck');
  await chrome.storage.local.set({
    driftState: { phase: 'work', driftStartTime: null, driftTrigger: null }
  });
}

// --- Active Tab Lifecycle ---
async function finalizeActiveTab() {
  if (!activeTab) return;
  const duration = Date.now() - activeTab.startTime;

  if (duration >= MIN_DWELL_MS) {
    await saveTabRecord({ ...activeTab, duration });
    if (classifyDomain(activeTab.domain) === 'drift') {
      await accumulateDriftTime(duration);
    }
  }
  activeTab = null;
}

async function setActiveTab(tab) {
  await finalizeActiveTab();

  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    activeTab = null;
    return;
  }

  activeTab = {
    tabId: tab.id,
    url: tab.url,
    title: tab.title || '',
    domain: extractDomain(tab.url),
    startTime: Date.now()
  };
  console.log(`[RHR] Tracking: ${activeTab.domain}`);

  // Update drift phase based on new active domain
  const type = classifyDomain(activeTab.domain);
  const data = await chrome.storage.local.get('driftState');
  const driftState = data.driftState || { phase: 'unknown' };

  if (type === 'drift' && driftState.phase !== 'drift') {
    await enterDriftPhase(activeTab.domain);
  } else if (type === 'work' && driftState.phase === 'drift') {
    await resetToWorkPhase();
  }
}

// --- Alarm Listener (fires when drift threshold is reached) ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'driftCheck') return;
  console.log('[RHR] Drift alarm fired — checking phase...');

  try {
    const data = await chrome.storage.local.get('driftState');
    const driftState = data.driftState || {};

    if (driftState.phase === 'drift') {
      await captureSnapshot();
    }
  } catch (err) {
    console.error('[RHR] Alarm handler error:', err);
  }
});

// --- Tab Event Listeners ---
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await setActiveTab(tab);
  } catch (err) {
    console.error('[RHR] onActivated error:', err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (tabId !== activeTab?.tabId) return;
  try {
    await setActiveTab(tab);
  } catch (err) {
    console.error('[RHR] onUpdated error:', err);
  }
});
