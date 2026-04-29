"""Simple HTTP server with cache completely disabled."""
import http.server
import os
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        """Override to skip If-Modified-Since check entirely."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            if not self.path.endswith('/'):
                self.send_response(301)
                self.send_header('Location', self.path + '/')
                self.end_headers()
                return None
            for index in ('index.html', 'index.htm'):
                idx = os.path.join(path, index)
                if os.path.exists(idx):
                    path = idx
                    break
            else:
                return self.list_directory(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        ctype = self.guess_type(path)
        fs = os.fstat(f.fileno())
        # Always return 200 with no-cache headers (never 304)
        self.send_response(200)
        self.send_header('Content-type', ctype)
        self.send_header('Content-Length', str(fs.st_size))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()
        return f

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    server = http.server.HTTPServer(('', port), NoCacheHandler)
    print(f'Serving on http://localhost:{port}  (no-cache mode)')
    server.serve_forever()
