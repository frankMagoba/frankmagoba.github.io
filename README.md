# frankmagoba.github.io

My personal site, live at https://frankmagoba.github.io/.

Plain HTML, CSS and ES modules with no build step. GitHub Pages serves the `master` branch root as-is.

- `js/content.js` holds every fact on the page. The project cards, the timeline, the terminal and the "Ask" box all read from it.
- `js/ask.js` matches questions against that content by keyword. "Smart search" loads a small embedding model (all-MiniLM-L6-v2 through transformers.js) in the browser, only once someone clicks it. It never generates text, so it can only quote what's already here.
- Press the backtick key, or the `>_` button, to open the terminal.

Run it locally with any static server, for example `python3 -m http.server 8000`, then open http://localhost:8000.
