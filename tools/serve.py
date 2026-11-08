"""Serve the repository for local play and testing.

    PORT=$(portbroker get --name sunken-crown-remastered) python3 tools/serve.py

Static files from the repository root, plus GET /whoami for portbroker.
SERVE_DIR serves another folder instead (the built site in dist/, say) and
SERVICE names it in /whoami.
"""
from __future__ import annotations

import json
import os
import socket
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(os.environ.get("SERVE_DIR") or Path(__file__).resolve().parents[1])
SERVICE = os.environ.get("SERVICE", "sunken-crown-remastered")
STARTED = time.strftime("%Y-%m-%dT%H:%M:%S%z")
PORT = int(os.environ.get("PORT", "0"))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webp": "image/webp", ".webm": "audio/webm", ".glb": "model/gltf-binary", ".js": "text/javascript"}

    def do_GET(self) -> None:
        if self.path.split("?")[0] == "/whoami":
            body = json.dumps({"service": SERVICE, "version": "0.1.0", "pid": os.getpid(), "startedAt": STARTED,
                               "host": socket.gethostname(), "port": PORT}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, PORT), partial(Handler, directory=str(ROOT)))
    print(f"{SERVICE} on http://{host}:{PORT}/remastered.html", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
