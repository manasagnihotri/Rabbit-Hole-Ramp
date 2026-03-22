# 🐇 Rabbit Hole Ramp

**The AI that helps you hop back out.**

Built by **Hoppers** at the Pioneering Minds AI: Grayscale Hackathon 2026 · Attention Track

---

## The Problem

Recommendation algorithms exploit the cognitive cost of context-switching. The harder it feels to return to work, the longer you keep scrolling. Every focus app tries to block distraction. None of them help you return.

## Our Insight

The bottleneck isn't entering the rabbit hole — it's climbing back out. Returning to deep work is hard because you've lost your mental context: what you were doing, where you left off, what the next step was.

## The Solution

Rabbit Hole Ramp is a Chrome extension that:

1. Tracks your browsing in the background (all data stays local)
2. Detects when you drift from work to distraction
3. Snapshots your open work tabs + live page content
4. Generates an AI re-entry summary using Claude — not just your tabs, but your train of thought
5. Closes drift tabs and restores your entire work session with one click

---

## Features

- **Drift detection** — detects work→distraction transitions after 30s (3 min in production)
- **AI re-entry summary** — Claude Sonnet 4.6 generates a warm, specific 2-3 sentence summary of what you were doing and what to do next
- **One-click restore** — closes social media tabs, reopens work tabs
- **Doomscroll tracking** — accumulates daily time on social media, fires a check-in notification every 10 minutes
- **Session history** — keeps the last 5 snapshots so you can review earlier work sessions
- **Privacy-first** — all browsing data stays in `chrome.storage.local`; only tab titles and short snippets hit the API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome Manifest V3 (Vanilla JS) |
| AI Summarization | Claude Sonnet 4.6 (Anthropic API) |
| Backend | FastAPI + Python 3.10+ |
| Storage | chrome.storage.local (on-device) |
| Timers | chrome.alarms (service-worker safe) |

---

## How to Run

### 1. Backend

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key_here
venv/bin/uvicorn main:app --reload --port 8000
```

Verify it's running:
```bash
curl http://localhost:8000/health
```

### 2. Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Pin the extension for easy access during the demo

### 3. Optional: Allow Incognito

In `chrome://extensions` → Rabbit Hole Ramp → **Allow in incognito**

---

## Demo Script

1. Open 3-4 work tabs (GitHub, arxiv, sklearn docs, Notion)
2. Switch to Reddit — browse for 30 seconds
3. Notification fires: *"You went down a rabbit hole. We saved your way back. 🐇"*
4. Click the extension icon
5. Read the AI re-entry summary aloud
6. Click **Restore My Flow** — Reddit closes, work tabs reopen
7. Total: ~90 seconds

> **Before the real demo:** change `DRIFT_THRESHOLD_MINUTES` from `0.5` to `3.0` in `extension/background.js`

---

## Project Structure

```
rabbit-hole-ramp/
├── extension/
│   ├── manifest.json       # Chrome MV3 config
│   ├── background.js       # Service worker: tab tracking, drift detection, snapshots
│   ├── content.js          # Content script: extracts live page text
│   ├── popup.html          # Extension popup
│   ├── popup.js            # Popup logic: renders snapshot, handles restore
│   ├── popup.css           # Styles
│   └── icons/              # 16, 48, 128px icons
├── backend/
│   ├── main.py             # FastAPI — POST /summarize
│   ├── prompts.py          # Claude prompt templates
│   └── requirements.txt
├── landing/
│   └── index.html          # Product landing page
└── README.md
```

---

## Team

| Name | LinkedIn |
|---|---|
| Manas Agnihotri | [linkedin.com/in/manas-agnihotri](https://www.linkedin.com/in/manas-agnihotri) |
| Suhani Wadhwa | [linkedin.com/in/suhaniwadhwa24](https://www.linkedin.com/in/suhaniwadhwa24) |

---

## Track

**Attention** — Giving attention back to the person who owns it.

> "Focus apps punish distraction. We reward the return."
