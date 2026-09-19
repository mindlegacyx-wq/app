"""Rate limit em memória por IP (janela deslizante).

Suficiente para uma instância no MVP. Ao escalar para várias réplicas, a mesma interface
passa a usar Redis; nenhuma rota muda.
"""

import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import RateLimitedError


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise RateLimitedError("Muitas tentativas. Aguarde um minuto e tente de novo.")
        q.append(now)

    def reset(self) -> None:
        self._hits.clear()


auth_limiter = SlidingWindowLimiter(limit=get_settings().auth_rate_limit_per_minute)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def limit_auth(request: Request) -> None:
    auth_limiter.check(client_ip(request))
