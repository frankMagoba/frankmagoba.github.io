# frankmagoba.github.io

Personal site for Franklin Magoba — https://frankmagoba.github.io/

Static HTML, CSS and ES modules. No build, no framework. GitHub Pages publishes the `master` branch root as-is. Push and it’s live.

## What’s on the page

- Hero with portrait, short intro, and a labeled contact panel (email, resume, LinkedIn, GitHub).
- Project grid with area filters, driven by `js/content.js`.
- Experience timeline, skills, education and certificate thumbnails.
- Ask box (`js/askterm.js`) that answers from the same content by keyword first. Optional “smart search” loads all-MiniLM-L6-v2 in the browser via transformers.js and only quotes what’s already on the page — it doesn’t invent answers.
- Full terminal: press `` ` `` or the `>_` control. Commands live in `js/terminal.js`.

`js/content.js` is the source of truth for facts. Keep it in sync with the copy in the [Resume](https://github.com/frankMagoba/Resume) repo when you change experience or projects.

Type uses SF Pro Text / Display on Apple (Helvetica Neue elsewhere). The terminal stays monospace.

## Local

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## Deploy

```bash
git push origin master
```
