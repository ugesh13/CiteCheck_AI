# pyright: reportMissingImports=false
import json
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
    On Vercel, requests to /api/(.*) or /api are rewritten to /api/index.py.
    This middleware restores the original requested path from:
    1. Query params `__subpath`, `__vercel_subpath`, or `__vercel_api_path`
    2. Vercel route match headers (x-now-route-matches)
    3. Proxy headers (x-forwarded-uri, x-original-url, x-rewrite-url, x-envoy-original-path, x-matched-path)
    4. Original ASGI scope path
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            query_str = scope.get("query_string", b"").decode("latin-1")
            restored_path = None

            # Optional diagnostic inspector
            if "debug_inspect=1" in query_str:
                headers_dict = {
                    k.decode("latin-1"): v.decode("latin-1")
                    for k, v in scope.get("headers", [])
                }
                body = json.dumps(
                    {
                        "original_scope_path": scope.get("path"),
                        "raw_query_string": query_str,
                        "headers": headers_dict,
                    },
                    indent=2,
                ).encode("utf-8")
                await send(
                    {
                        "type": "http.response.start",
                        "status": 200,
                        "headers": [
                            [b"content-type", b"application/json"],
                            [b"content-length", str(len(body)).encode("latin-1")],
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": body})
                return

            # 1. Check query parameter injected by vercel.json rewrite
            raw_sub = None
            if any(
                token in query_str
                for token in ("__subpath=", "__vercel_subpath=", "__vercel_api_path=")
            ):
                params = parse_qs(query_str, keep_blank_values=True)
                for key in ("__subpath", "__vercel_subpath", "__vercel_api_path"):
                    if key in params:
                        raw_sub = params.pop(key)[0].strip()
                        break
                cleaned_qs = urlencode(
                    [(k, v) for k, vs in params.items() for v in vs]
                )
                scope["query_string"] = cleaned_qs.encode("latin-1")

                # Validate raw_sub is not an unexpanded token
                if raw_sub is not None and raw_sub not in (
                    "$1",
                    ":match*",
                    ":path*",
                    "/api/$1",
                    "/api/:match*",
                    "/api/:path*",
                ):
                    sub_clean = raw_sub.split("?")[0].strip()
                    if sub_clean.startswith("/api"):
                        restored_path = sub_clean
                    elif sub_clean in ("docs", "openapi.json", "healthz"):
                        restored_path = f"/{sub_clean}"
                    elif sub_clean:
                        restored_path = f"/api/{sub_clean.lstrip('/')}"
                    else:
                        restored_path = "/api"

            # 2. Check x-now-route-matches header
            headers = dict(scope.get("headers", []))
            if not restored_path and b"x-now-route-matches" in headers:
                try:
                    match_qs = headers[b"x-now-route-matches"].decode("latin-1")
                    m_params = parse_qs(match_qs)
                    match_val = m_params.get(
                        "1", m_params.get("match", m_params.get("path", [""]))
                    )[0].strip()
                    if match_val and match_val not in ("$1", ":match*", ":path*"):
                        if match_val.startswith("/api"):
                            restored_path = match_val
                        elif match_val:
                            restored_path = f"/api/{match_val.lstrip('/')}"
                except Exception:
                    pass

            # 3. Check proxy headers
            if not restored_path:
                for header_key in (
                    b"x-forwarded-uri",
                    b"x-original-url",
                    b"x-rewrite-url",
                    b"x-envoy-original-path",
                ):
                    val = headers.get(header_key)
                    if val:
                        try:
                            candidate = val.decode("utf-8").split("?")[0].strip()
                            if candidate and not candidate.endswith(
                                "index.py"
                            ) and not candidate.endswith("/index"):
                                restored_path = candidate
                                break
                        except Exception:
                            pass

            # 4. Check original scope path
            curr_path = scope.get("path", "")
            if not restored_path:
                if curr_path and curr_path not in (
                    "/api/index.py",
                    "/api/index",
                    "/api",
                    "/api/",
                ):
                    restored_path = curr_path
                elif curr_path in ("/api/index.py", "/api/index"):
                    restored_path = "/api"

            if restored_path:
                if not restored_path.startswith("/"):
                    restored_path = "/" + restored_path
                scope["path"] = restored_path

        await self.app(scope, receive, send)


app = VercelPathMiddleware(fastapi_app)
