import os
import sys

# Ensure backend directory is discoverable by python
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app as fastapi_app

class VercelPathMiddleware:
    """
    Vercel rewrites /api/(.*) to /api/index.py.
    This middleware restores the original requested path from Vercel's headers
    (x-matched-path, x-vercel-matched-path, or x-forwarded-uri) so that
    FastAPI routers match the actual API endpoints (e.g. /api/v1/auth/login).
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            headers = dict(scope.get("headers", []))
            matched = (
                headers.get(b"x-matched-path")
                or headers.get(b"x-vercel-matched-path")
                or headers.get(b"x-forwarded-uri")
            )
            if matched:
                try:
                    orig_path = matched.decode("utf-8").split("?")[0]
                    # If original path is /api/index.py, leave as-is; otherwise restore real path
                    if orig_path and not orig_path.endswith("index.py") and not orig_path.endswith("index"):
                        scope["path"] = orig_path
                except Exception:
                    pass
        await self.app(scope, receive, send)

app = VercelPathMiddleware(fastapi_app)

