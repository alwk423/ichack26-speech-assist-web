Speech Assistant — Local Development README
==========================================

Overview
--------

This repository contains the **web prototype** of SpeakEasy, a context-aware communication assistant for people with speech impairments. The prototype demonstrates how users can choose a context (for example: `medical`, `restaurant`, `home`) then provide context-specific voice input that the system converts into a set of short, suggested replies.

The goal is to reduce the time and friction of text-based communication — especially for people who rely on sign language or have limited speech — by offering quick, context-appropriate response options the user can pick and send. 

The project includes a **FastAPI backend** and a lightweight **HTML/JS/CSS frontend** to showcase the end-to-end flow.

This README explains how to run the project locally, where to add the Anthropic API key, and how to use the endpoints.

> **Security:** Do not commit your API keys. The repository ignores `backend/.env` and root `.env`.

## Android App & References

For the full Android version with richer features, see:
- **Android Repository:** https://github.com/Justrene/SpeakEasy
- **Ichack26 Submission:** https://devpost.com/software/speakeasy-2x689r

## Prerequisites

- Python 3.10+ (or 3.8+) for backend
- A browser (Chrome/Edge/Firefox) supporting Web Speech API for voice input
- An Anthropic API key (set in `backend/.env` as `ANTHROPIC_API_KEY`)


## Quick setup

Follow the copy-paste commands below. All commands assume you're at the project root (the folder that contains `backend/` and `frontend/`).

1) Create a Python virtualenv and install backend dependencies

```bash
# create and activate venv (macOS / Linux)
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2) Add your Anthropic API key

Create `backend/.env` and add your key:

```env
ANTHROPIC_API_KEY="sk-...your-key-here..."
```

3) Start the backend and frontend

Option A — run servers manually (recommended while developing)

```bash
# terminal 1: start backend (from project root)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2: serve frontend
cd frontend
python3 -m http.server 5500
# then open http://localhost:5500 in your browser
```

Option B — use the Makefile convenience target

```bash
make start
```

What `make start` does:

- kills processes listening on ports `8000` and `5500` (if any)
- ensures `backend/venv` exists and installs `requirements.txt`
- starts the FastAPI backend via `uvicorn` on port `8000` (background)
- starts a simple Python HTTP server for the frontend on port `5500`

Notes:

- If you prefer to avoid the Makefile killing ports automatically, run the manual commands in Option A.
- On macOS with zsh, `source venv/bin/activate` works in a normal terminal. If you use `fish` or another shell, adapt activation accordingly.
- The backend reads `ANTHROPIC_API_KEY` from `backend/.env` at runtime. Keep that file out of git and rotate the key if it is ever exposed.


## Quick health check

```bash
curl http://127.0.0.1:8000/health
# expected: {"ok": true}
```

## What the App Does (User-Facing)

- **Pick a context** — Select from predefined scenarios (e.g., `medical`, `restaurant`, `family`) that frame how replies are generated.
- **Provide voice input** — Speak naturally into your browser; the app converts speech to text and sends it to the backend.
- **Receive suggestions** — Get up to six short, context-appropriate reply suggestions tailored to your situation.
- **Communicate faster** — Provide context and voice input, receive immediate suggestions, and send them directly (full text editing is a planned feature).
- **Improve accessibility** — Help people with speech impairments, sign language users, and others communicate more naturally and quickly.

**Note:** More advanced workflows (persistent conversation history, a dedicated `Submit` button, and full text-editing capabilities) are available in the [Android app](#android-app). This web prototype focuses on the core voice-to-suggestion interaction.

## API (backend)

1) POST /suggest

- URL: `http://127.0.0.1:8000/suggest`
- Body JSON:
  - `session_id` (string)
  - `last_text` (string) — the user's latest text or conversation history
  - `context` (string, optional)
  - `mode` (string, optional)
- Response: JSON object with `suggestions` (array of `{id, text, intent, score}`)

Example (HTTPie):

```bash
http POST :8000/suggest session_id=abc last_text='Hello, I need help' context=generic
```

2) POST /log_choice

- URL: `http://127.0.0.1:8000/log_choice`
- Body JSON: `session_id`, `suggestion_id`, `context`, `intent`, `text`

Example (HTTPie):

```bash
http POST :8000/log_choice session_id=abc suggestion_id='generic:clarify:0' context=generic intent=clarify text='Could you rephrase?'
```

## Frontend notes

- Files: `frontend/index.html`, `frontend/app.js`, `frontend/style.css`.
- Conversation window: scrollable pane above the transcript showing `user` and `assistant` bubbles.
- Auto-submit timeout: 5 seconds (change `5000` in `frontend/app.js`).
- Predefined contexts: configure `CONTEXTS` in `frontend/app.js`.

## Backend notes

- Main app: `backend/app/main.py`
- Routing and suggestion logic: `backend/app/routes.py`
- Claude integration and prompt: `backend/app/claude.py` (reads `ANTHROPIC_API_KEY` from environment)
- Fallback phrase packs: `backend/app/phrasepacks.py` (used when Claude fails)

## Troubleshooting

- If frontend shows network errors, ensure backend is running at `http://127.0.0.1:8000`.
- If Claude calls fail, confirm `backend/.env` contains a valid `ANTHROPIC_API_KEY` and check backend logs for `[CLAUDE]` messages.
- If you accidentally committed an API key, rotate it immediately and remove the key from repo history.

## Future Extensions

### Travel Context
A dedicated **travel context** would enable users to quickly generate context-appropriate responses for common travel scenarios:
- Hotel interactions (check-in, room requests, amenity inquiries)
- Restaurant and dining experiences
- Transportation and navigation assistance
- Tourist attractions and local interactions

This would allow travelers to communicate seamlessly in unfamiliar environments without language barriers.

### Translation Features
Adding **translation capabilities** would be a natural next step to make the app accessible to international users:
- **Speech-to-text translation**: Convert the user's voice input to text in another language before generating suggestions
- **Suggestion translation**: Automatically translate generated replies into the user's preferred language(s)
- **Multi-language support**: Support for common travel languages (Spanish, French, German, Mandarin, Japanese, etc.)

Translation would significantly enhance usability for travelers and multilingual communities, making it easier to communicate across language barriers.

## Contributing / Next Steps

- **Improve conversation context handling** — send last N turns rather than raw history for better context awareness.
- **Add unit/integration tests** — ensure backend endpoints are robust and maintainable.
- **Harden CORS and deployment settings** — prepare for secure production deployment.
- **Implement travel context and translation** — extend the app for international and travel use cases.

