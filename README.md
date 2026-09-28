# agent-browser-jev-demo

Type a site and something to find, or pick one of the examples. A real
browser walks the site one click at a time. Each screen it visits shows up on
the left as it happens, and the panel on the right shows what's going on
behind it: every agent-browser action, every Jev decision, and how long each
one took.

```
stripe.com: find the fee for international cards
```

One page, no accounts, no database, no background jobs. Nothing is saved;
refresh and it's gone.

## Run it

```sh
cp .env.example .env   # add JEV_API_KEY (Cloudinary keys are optional)
bun install
bun run dev
```

Journeys use your local Chrome, which agent-browser finds on its own.

## How it works

1. The page posts the text to `/run` (`app/routes/run.ts`).
2. `parsePrompt()` (`app/lib/journey/prompt.ts`) pulls out the first web
   address as the start URL; the whole sentence is the goal.
3. `navigate()` (`app/lib/journey/navigate.server.ts`) opens the site in
   Chrome through the [agent-browser](https://github.com/vercel-labs/agent-browser)
   CLI. On each screen it asks Jev (TypeSafe's System One model) two
   questions: is this the destination, and which element should be clicked
   next. It screenshots the screen, then clicks.
4. Each screenshot goes to Cloudinary (or, without Cloudinary keys, straight
   into the response as a data URL) and streams back to the page as one line
   of JSON. The page draws it with a blue ring on the element that was
   clicked, and a green ring on the passage that answers the goal.
5. Along the way the loop reports each browser action (with the
   agent-browser command and how many CLI calls it took) and each Jev
   decision (the arrival probability, the chosen click and its confidence,
   token count), all timed. They stream as `activity` lines and fill the
   "Behind the scenes" panel. Its info button opens a developer-facing
   explanation of how the two tools hand off to each other.

A journey stops when Jev finds the destination, runs out of ideas, hits 10
screens, or meets a bot check (it never tries to get past one). Only public
http(s) sites can be visited.

| File                                 | What it does                                   |
| ------------------------------------ | ---------------------------------------------- |
| `app/routes/home.tsx`                | The page: text box, examples, screenshots      |
| `app/components/ActivityPanel.tsx`   | The "Behind the scenes" timeline and timings   |
| `app/components/AboutDialog.tsx`     | The info modal: how agent-browser and Jev fit  |
| `app/routes/run.ts`                  | Runs a journey and streams it as NDJSON        |
| `app/lib/journey/navigate.server.ts` | The read, judge, screenshot, click loop        |
| `app/lib/journey/browser.server.ts`  | agent-browser CLI wrapper                      |
| `app/lib/journey/judge.server.ts`    | The Jev questions                              |
| `app/lib/journey/candidates.ts`      | Which elements are clickable, same-site checks |
| `app/lib/journey/focus.ts`           | Goal-focused page text for long pages          |
| `app/lib/cloudinary.server.ts`       | Screenshot upload (or data URL fallback)       |

## Deploy

The `Dockerfile` installs Chromium next to the web server, so any host that
runs a container works. Set `JEV_API_KEY` (and optionally the Cloudinary
keys) on the host. Each journey holds one request open for up to a few
minutes and runs its own Chrome, so this suits a demo, not heavy traffic.

## Commands

| Command             | Purpose                   |
| ------------------- | ------------------------- |
| `bun run dev`       | Dev server                |
| `bun run test`      | Unit tests (pure helpers) |
| `bun run typecheck` | Route types + tsc         |
| `bun run build`     | Production build          |
| `bun run start`     | Serve the build           |
| `bun run format`    | Prettier                  |
