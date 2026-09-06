# HumanCare Connect — Monitoring browser extension

A **sensor** for the §5b search / AI-prompt monitoring feature. It runs inside
the page, so it reads the query straight from the DOM and the real URL — no
Windows UI Automation, no polling, no guessing whether something was submitted.
It is a strictly better replacement for the desktop agent's UIA capture loop,
which stays as a fallback for browsers without the extension.

## What it captures

Only two things, and nothing else:

- **Search queries** — a value committed (form submit, Enter, or a SPA
  navigation to a `?q=`/`?search_query=`/… URL) in a field that is identifiably
  a search box (`type=search`, `role=searchbox`, a `role="search"` / `<search>`
  ancestor, a `q`/`search`/`query`/`keyword` name/label token, or a form that
  submits to a search URL).
- **AI-assistant prompts** — the text submitted in the composer on a known
  assistant host (ChatGPT, Claude, Gemini, Copilot, Perplexity).

It never reads any other field, never reads page content, never logs, and never
stores captured text (it is a pass-through to the agent). Incognito / private
windows are filtered and never forwarded. Blocklisted hosts
(banking / payment / health / government) are dropped in the content script,
again in the background worker, and again on the server.

## Architecture

```
 page DOM events → content.bundle.js → background.js
      → (Chrome native messaging) → native-host → (named pipe) → desktop agent
      → agent content pipeline → POST /api/monitoring/agent/content
      → same consent / legal gate / blocklist / encryption / audit as the UIA path
```

The **agent is the source of truth**: the extension is inert until the agent
tells it capture is active (which the agent only does when the server heartbeat
says `content_capture.active === true` — legal gate open + org enabled +
employee consent on file). The agent also pushes the current blocklist.

## Build

```
npm run build      # -> dist/  (load unpacked, or zip for the Web Store / policy)
npm test           # detector unit tests
```

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the force-install policy keys, the native
messaging host manifest, and how the extension ID is pinned.
