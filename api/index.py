# pyright: reportMissingImports=false
import os
import sys
from urllib.parse import parse_qs, urlencode

# Ensure backend directory is discoverable by python
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.main import app as fastapi_app
except ImportError:
    from backend.app.main import app as fastapi_app

class VercelPathMiddleware:
    """
    On Vercel, requests to /api/(.*) or /api/:path* are rewritten to /api/index.py.
    This middleware restores the original requested path from:
    1. Query param `__vercel_api_path` injected by vercel.json rewrite
    2. Request headers: x-forwarded-uri, x-original-url, x-rewrite-url, x-matched-path, x-vercel-matched-path
    This ensures FastAPI routers match the actual API endpoints (e.g. /api/drafts, /api/brand-kit).
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            query_str = scope.get("query_string", b"").decode("latin-1")
            restored_path = None

            # 1. Check if injected via vercel.json rewrite query string
            if "__vercel_api_path=" in query_str:
                params = parse_qs(query_str, keep_blank_values=True)
                if "__vercel_api_path" in params:
                    raw_path = params.pop("__vercel_api_path")[0].strip()
                    cleaned_qs = urlencode([(k, v) for k, vs in params.items() for v in vs])
                    scope["query_string"] = cleaned_qs.encode("latin-1")
                    # Ignore unexpanded template tokens or empty subpaths
                    if raw_path and raw_path not in ("/api/$1", "/api/:match*", "/api/:path*", "/api/"):
                        restored_path = raw_path.split("?")[0]

            # 2. Check headers fallback if not found in query param
            if not restored_path or restored_path == "/api":
                headers = dict(scope.get("headers", []))
                for header_key in (
                    b"x-forwarded-uri",
                    b"x-original-url",
                    b"x-rewrite-url",
                    b"x-matched-path",
                    b"x-vercel-matched-path",
                ):
                    val = headers.get(header_key)
                    if val:
                        try:
                            candidate = val.decode("utf-8").split("?")[0].strip()
                            if candidate and not candidate.endswith("index.py") and not candidate.endswith("/index") and candidate != "/api":
                                restored_path = candidate
                                break
                        except Exception:
                            pass

            if restored_path:
                if not restored_path.startswith("/"):
                    restored_path = "/" + restored_path
                scope["path"] = restored_path
            elif scope.get("path") in ("/api/index.py", "/api/index"):
                # If path is literally /api/index.py with no subpath detected, route to /api
                scope["path"] = "/api"

        await self.app(scope, receive, send)

app = VercelPathMiddleware(fastapi_app)

