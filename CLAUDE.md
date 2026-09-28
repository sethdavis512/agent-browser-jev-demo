# CLAUDE.md

agent-browser-jev-demo: a barebones demo of agent-browser and Jev.
One page (`app/routes/home.tsx`) with one text box; `/run` (`app/routes/run.ts`)
drives Chrome through agent-browser, asks Jev what to click, and streams each
screenshot back as newline-delimited JSON. See README.md for the file map.

## Keep it barebones

This repo exists to show the core idea and nothing else. Don't add a
database, auth, background jobs, extra routes, or a component library.

## Notes

- React Router 8 (framework mode, SSR). Middleware is always on; never add
  `future.v8_*` flags. `/run` is a resource route (action only).
- Env is read from `process.env` directly: `JEV_API_KEY` (required),
  `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`
  (optional; without them screenshots are inlined as data URLs).
- `/run` sets `Cache-Control: no-transform` so react-router-serve's
  compression doesn't buffer the stream. Closing the page aborts the request,
  which ends the loop and closes the browser.
- Production is the `Dockerfile` (Debian + chromium, runs as root, so
  `browser.server.ts` adds `--no-sandbox`).
- Formatting: Prettier, 4 spaces, single quotes. `bun run format`.

## Production

Railway project `agent-browser-jev-demo`, service `web`, at
https://web-production-512c2.up.railway.app. It builds the `Dockerfile` and
deploys automatically on every push to `main`. Variables: `JEV_API_KEY` and the
three `CLOUDINARY_*` keys. Check it with
`railway logs --service web --lines 100`.
