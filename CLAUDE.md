# CLAUDE.md

agent-browser-jev-demo: a barebones demo of agent-browser and Jev, for
showing to people who may not know either. Three pages:

- `/` (`app/routes/home.tsx`): picks between the two demos.
- `/jev` (`app/routes/jev.tsx`): Jev on its own. Ten examples in
  `app/lib/jev/examples.ts` cover noul, choice, and score; visitors only edit
  the state, and the route's action builds the SDK questions server-side
  (`app/lib/jev/ask.server.ts`).
- `/agent-browser` (`app/routes/agent-browser.tsx`): Jev drives Chrome.
  `/run` (`app/routes/run.ts`) runs the loop and streams screenshots and
  timed activity back as newline-delimited JSON.

See README.md for the file map.

## Keep it barebones

This repo exists to show the core ideas and nothing else. Don't add a
database, auth, background jobs, or a component library. New pages should be
another small playground the home picker links to.

## Notes

- React Router 8 (framework mode, SSR). Middleware is always on; never add
  `future.v8_*` flags. `/run` is a resource route (action only).
- Gotcha: every production host must be in `allowedActionOrigins`
  (`react-router.config.ts`). Behind Railway's proxy, react-router-serve sees
  `http://` while browsers send `https://`, so UI-route actions like `/jev`'s
  fail with a 400 otherwise. Resource routes like `/run` are exempt.
- The Jev client lives in `app/lib/typesafe.server.ts`, shared by both demos.
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
