import os
import sys

# Ensure backend directory is discoverable by python
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from urllib.parse import parse_qs, urlencode

from app.main import app as fastapi_app

class VercelPathMiddleware:
    """
    Vercel rewrites /api/(.*) to /api/index.py.
    This middleware restores the original requested path from:
    1. Query param `__vercel_api_path` injected by vercel.json rewrite
    2. Headers: x-forwarded-uri, x-matched-path, x-vercel-matched-path, x-original-url, x-rewrite-url
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
                    raw_path = params.pop("__vercel_api_path")[0]
                    restored_path = raw_path.split("?")[0]
                    cleaned_qs = urlencode([(k, v) for k, vs in params.items() for v in vs])
                    scope["query_string"] = cleaned_qs.encode("latin-1")

            # 2. Check headers fallback if not found in query param
            if not restored_path:
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
                            candidate = val.decode("utf-8").split("?")[0]
                            if candidate and not candidate.endswith("index.py") and not candidate.endswith("/index"):
                                restored_path = candidate
                                break
                        except Exception:
                            pass

            if restored_path:
                if not restored_path.startswith("/"):
                    restored_path = "/" + restored_path
                scope["path"] = restored_path

        await self.app(scope, receive, send)

app = VercelPathMiddleware(fastapi_app)

