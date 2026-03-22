# Rabbit Hole Ramp — Product Spec

## Overview

Rabbit Hole Ramp is a Chrome extension + Python backend that helps knowledge workers return to deep work after internet distractions. Instead of blocking distractions, it snapshots work context when the user drifts and uses an LLM to generate a re-entry summary.

---

## Core Features

### 1. Tab Tracking
- The extension must record every browser tab the user visits
- A tab is only recorded if the user stays on it for at least 10 seconds
- Each tab record must include: URL, title, domain, type (work/drift/unknown), timestamp, duration
- Tab history must be capped at 100 entries
- Tab history must persist in chrome.storage.local

### 2. Domain Classification
- Domains must be classified into three categories: `work`, `drift`, or `unknown`
- Work domains include: docs.google.com, github.com, stackoverflow.com, arxiv.org, notion.so, linear.app, figma.com, and others
- Drift domains include: reddit.com, youtube.com, twitter.com, x.com, instagram.com, tiktok.com, facebook.com, and others
- Any domain not in either list is classified as `unknown`

### 3. Drift Detection
- The extension must detect when the user transitions from a work domain to a drift domain
- After the user has been on drift domains for 3 minutes (configurable), a snapshot must be captured
- Drift detection must use chrome.alarms (not setTimeout) to survive service worker suspension
- If the user returns to a work domain before the threshold, the drift alarm must be cancelled

### 4. Work Context Snapshot
- When drift threshold is reached, the extension must capture a snapshot
- The snapshot must include: all currently open non-drift tabs (up to 5), captured timestamp, drift trigger domain
- Live page content (title + first 300 characters of body text) must be extracted from each open work tab
- chrome://  and chrome-extension:// pages must be excluded from snapshots
- Gmail and calendar tabs must be excluded from snapshots
- Snapshots must be stored in chrome.storage.local (last 5 kept)
- A Chrome notification must fire immediately when a snapshot is captured

### 5. AI Re-Entry Summary
- After capturing a snapshot, the extension must POST tab data to the backend
- The backend must call the Anthropic API (Claude Sonnet 4.6) with the work tab context
- The response must be a 2-3 sentence plain-text summary
- The summary must name the specific task, describe where the user left off, and suggest a next step
- The summary tone must be warm and casual — never preachy or guilt-inducing
- If the API call fails or times out (10 seconds), the snapshot is saved without a summary
- The popup must show a fallback message if no summary is available

### 6. Doomscroll Time Tracking
- The extension must track cumulative time spent on drift domains each day
- Drift time must reset at midnight
- A Chrome notification must fire every time cumulative drift time crosses a 10-minute interval
- Drift stats must be stored in chrome.storage.local with the current date

### 7. Popup UI
- The popup must display the most recent snapshot's AI summary as the primary element
- The popup must show a timestamp ("Saved X minutes ago")
- The popup must list the work tab titles from the snapshot
- The popup must show daily doomscroll time in the header
- The popup must include a "Restore My Flow" button
- The popup must show a session history of previous snapshots (expandable)

### 8. Restore My Flow
- Clicking "Restore My Flow" must close all currently open drift domain tabs
- Clicking "Restore My Flow" must open each work tab from the snapshot in a new tab
- The popup must close after restore is triggered

---

## Constraints

- All browsing data must remain in chrome.storage.local — no browsing history is sent to any server
- Only tab titles and short text snippets (max 300 chars) may be sent to the backend API
- The extension must use Chrome Manifest V3
- The extension must use chrome.alarms for all timers — no setTimeout or setInterval in service workers
- The backend must have CORS enabled for local development
- The ANTHROPIC_API_KEY must be loaded from an environment variable — never hardcoded
- The popup width must be 380px
- No external fonts or CDN dependencies — everything must work offline except the Anthropic API call

---

## API Contract

### POST /summarize

**Request:**
```json
{
  "tabs": [
    {
      "url": "string",
      "title": "string",
      "snippet": "string",
      "domain": "string"
    }
  ],
  "drift_trigger": "string"
}
```

**Response:**
```json
{
  "summary": "string",
  "timestamp": "ISO 8601 string"
}
```

**Error behavior:** Returns HTTP 400 if no tabs provided. Returns HTTP 500 if API key is missing. Returns HTTP 502 if Anthropic API call fails.

---

## Out of Scope (V1)

- Mobile support
- Cross-browser support (Firefox, Safari)
- User-configurable domain lists
- Sync across devices
- Analytics dashboard
- Machine learning-based drift classification
