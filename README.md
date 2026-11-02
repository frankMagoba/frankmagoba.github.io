# frankmagoba.github.io

Personal site for Franklin Magoba — https://frankmagoba.github.io/

Static HTML, CSS and ES modules. No build, no framework. GitHub Pages publishes the `master` branch root as-is. Push and it’s live.

## What’s on the page

- Hero with portrait, short intro, and a labeled contact panel (email, resume, LinkedIn, GitHub).
- Project grid with area filters, driven by `js/content.js`.
- Experience timeline, skills, education and certificate thumbnails.
- Ask box (`js/askterm.js`) that answers from the same content by keyword first. Optional “smart search” loads all-MiniLM-L6-v2 in the browser via transformers.js and only quotes what’s already on the page — it doesn’t invent answers.
- Full terminal: press `` ` `` or the `>_` control. Commands live in `js/terminal.js`. `neofetch` prints the visitor's own device.
- Boot screen (`js/boot.js`): on the first visit in a session, a short log of what the visitor's browser exposes (system, GPU, screen, local time against Nairobi), then it slides away. `js/visitor.js` reads it all locally, with no network requests or permission prompts. Skipped for deep links and reduced motion; add `?boot` to the URL to replay it.
- Sound (`js/sound.js`): synthesised with the Web Audio API, no audio files. Off until the speaker button turns it on, and remembered.
- Reveal on scroll and the hero's count-up stats live in `js/reveal.js`; styles for all of the above are in `css/fx.css`.
- Work (`js/work.js`): projects as a numbered list; opening one runs a build, test and review pipeline before its details show.
- Skills (`js/toolbox.js`): skill bubbles in glass bins on one canvas with a small physics sim. Drag, shake, put back, or click a bubble to see where the skill shows up on the page (worked out in `js/main.js` from project stacks and write-ups). Screen readers get the same skills as plain lists.
- Now building (`js/building.js`): Keyhold. Drag the key into the lock (or click it) and its details decrypt from scrambled text. Reads the Keyhold entry from `projects`.
- Experience (`js/career.js`): a cable with a port per role plus the degree; drag the plug, click a year or use the arrow keys. "Show the whole list" opens every role.
- Certificates (`js/certs.js`): flip cards with a seal, tilt and shine; the back shows the certificate and opens it in the macOS-style window from `certviewer.js`.
- Section heads, the work list and the toolbox are styled in `css/sections.css`; the header, its scroll progress bar and the macOS-style certificate window are in `css/style.css`.

`js/content.js` is the source of truth for facts. Keep it in sync with the copy in the [Resume](https://github.com/frankMagoba/Resume) repo when you change experience or projects.

Type uses SF Pro Text / Display on Apple (Helvetica Neue elsewhere). The terminal stays monospace.

## Local

```bash
python3 scripts/serve.py
```

Open http://localhost:8000. This server turns off browser caching, so edits always show on reload (plain `python3 -m http.server` can serve a stale `main.js`). Like GitHub Pages, it serves `/Resume/` from the Resume repo next to this one (`../Resume/dist`, then `../Resume/public`), so the resume links work locally; run `npm run build` there if `dist/` is stale.

## Deploy

```bash
git push origin master
```
