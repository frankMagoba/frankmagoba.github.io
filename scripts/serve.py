# Local static server that tells the browser not to cache, so edits always show on reload.
# Usage: python3 scripts/serve.py [port]   (serves this repo, default port 8000)
#
# Like GitHub Pages, /Resume/ is served from the Resume repo next to this one (its dist/ build,
# then public/ for files such as resume.pdf), so the CV button and resume links work locally too.
# Run `npm run build` in ../Resume first if dist/ is missing or stale.
import functools, http.server, pathlib, sys, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESUME = ROOT.parent / "Resume"

class NoCache(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        if rel == "/Resume":
            rel = "/Resume/"
        if rel.startswith("/Resume/"):
            sub = rel[len("/Resume/"):] or "index.html"
            for base in (RESUME / "dist", RESUME / "public"):
                target = (base / sub).resolve()
                if target.is_relative_to(base.resolve()) and target.exists():
                    return str(target)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Serving {ROOT} at http://localhost:{port} (and /Resume/ from {RESUME})")
http.server.ThreadingHTTPServer(("", port), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
