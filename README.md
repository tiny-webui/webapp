# TinyWebUI

A lightweight chat interface built with Next.js and React. Requires the matching TinyWebUI server.

## How to Use

Open your deployment, sign in, select a model, and start chatting. Administrators can configure model providers in Settings.

Use each chat's actions menu to rename, pin, unpin, or delete it. Pinned chats appear first; both lists are ordered by the latest successful message write.

## How to Build

Use a current Node.js LTS release and npm. From the repository root:

```bash
git submodule update --init --recursive
npm install
npm run build
```

The build generates static files in `out/`. Serve them with a reverse proxy that routes `/api` WebSocket traffic to the backend on the same origin.

For local development, run `npm run dev` (port 3000). Keep the same `/api` proxy arrangement, routing other requests to the dev server.

Run `npm test` for the app and SDK tests.
