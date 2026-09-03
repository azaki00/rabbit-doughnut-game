#!/usr/bin/env python3
"""Dev server for Hare & Glaze.

`python -m http.server` sends Last-Modified and lets the browser cache ES
modules aggressively. During development that means you edit a file, reload,
and Chrome quietly serves you the previous version — which looks exactly like
"my change did nothing" and costs a lot of time to diagnose.

This server sends no-store on everything, so a reload is always the real file.

    python serve.py [port]        # default 8177
"""

import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8177
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # keep the console readable: only surface failures
        status = args[1] if len(args) > 1 else ""
        if str(status).startswith(("4", "5")):
            super().log_message(fmt, *args)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with ReusableTCPServer(("", PORT), handler) as httpd:
        print(f"Hare & Glaze  ->  http://localhost:{PORT}")
        print("Caching disabled; every reload fetches the real files. Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
