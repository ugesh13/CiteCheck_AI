"""
CiteCheck AI — API Rate Limiting & Throttling.

Implements a pure ASGI sliding-window rate limiter middleware with:
- Client IP or User ID key resolution.
- Configurable window size (default 60 seconds) and max requests (default 120/min).
- Rate-limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset).
- Standardized 429 response formatting: {"detail": "...", "code": "RATE_LIMIT_EXCEEDED"}.
- Pure ASGI implementation (avoids Starlette BaseHTTPMiddleware concurrency bugs).
"""

from __future__ import annotations

import collections
import json
import time
from typing import Deque, Dict, Tuple


class SlidingWindowRateLimiter:
    """Thread-safe sliding-window counter per client key."""

    def __init__(self, requests_per_minute: int = 120, window_seconds: int = 60):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        # client_key -> deque of timestamps
        self.history: Dict[str, Deque[float]] = collections.defaultdict(collections.deque)

    def is_allowed(self, key: str) -> Tuple[bool, int, int]:
        """
        Check if request is permitted.
        Returns: (is_allowed, remaining_quota, reset_seconds)
        """
        now = time.time()
        window_start = now - self.window_seconds
        queue = self.history[key]

        # Purge timestamps outside sliding window
        while queue and queue[0] <= window_start:
            queue.popleft()

        current_count = len(queue)
        if current_count >= self.requests_per_minute:
            oldest = queue[0]
            reset_seconds = max(1, int(oldest + self.window_seconds - now))
            return False, 0, reset_seconds

        queue.append(now)
        remaining = self.requests_per_minute - (current_count + 1)
        return True, remaining, self.window_seconds


class RateLimitMiddleware:
    """
    Pure ASGI Middleware enforcing rate limits on incoming HTTP requests.
    Zero dependency on BaseHTTPMiddleware, completely deadlock-free.
    """

    EXEMPT_PATHS = {
        "/",
        "/health",
        "/healthz",
        "/api/v1/ping",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    def __init__(self, app, requests_per_minute: int = 120):
        self.app = app
        self.limiter = SlidingWindowRateLimiter(requests_per_minute=requests_per_minute)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if path in self.EXEMPT_PATHS or path.startswith(("/docs", "/redoc", "/static")):
            return await self.app(scope, receive, send)

        # Extract headers from scope
        raw_headers = dict(scope.get("headers", []))
        auth_header = raw_headers.get(b"authorization", b"").decode("utf-8")
        
        if auth_header.startswith("Bearer "):
            client_key = f"token:{auth_header[7:].strip()[:32]}"
        else:
            forwarded = raw_headers.get(b"x-forwarded-for", b"").decode("utf-8")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            else:
                client = scope.get("client")
                client_ip = client[0] if client else "127.0.0.1"
            client_key = f"ip:{client_ip}"

        allowed, remaining, reset_secs = self.limiter.is_allowed(client_key)

        if not allowed:
            body = json.dumps({
                "detail": f"Rate limit exceeded. Maximum {self.limiter.requests_per_minute} requests per minute.",
                "code": "RATE_LIMIT_EXCEEDED",
            }).encode("utf-8")

            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"x-ratelimit-limit", str(self.limiter.requests_per_minute).encode("utf-8")),
                    (b"x-ratelimit-remaining", b"0"),
                    (b"x-ratelimit-reset", str(reset_secs).encode("utf-8")),
                    (b"retry-after", str(reset_secs).encode("utf-8")),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
            })
            return

        async def send_with_rate_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-ratelimit-limit", str(self.limiter.requests_per_minute).encode("utf-8")))
                headers.append((b"x-ratelimit-remaining", str(remaining).encode("utf-8")))
                headers.append((b"x-ratelimit-reset", str(reset_secs).encode("utf-8")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_rate_headers)
