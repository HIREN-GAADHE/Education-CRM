"""
Rate Limiting Middleware - Limits requests per IP/user to prevent abuse.
Uses in-memory storage (for single instance) or Redis (for distributed).
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio
from typing import Dict, Tuple
import logging

from app.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using in-memory storage.
    For production with multiple instances, use Redis instead.
    """
    
    def __init__(self, app, max_requests: int = None, window_seconds: int = None):
        super().__init__(app)
        self.max_requests = max_requests or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_PERIOD
        # In-memory storage: {key: [(timestamp, count)]}
        self._requests: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()
    
    def _get_client_key(self, request: Request) -> str:
        """Generate unique key for client (IP + optional user ID)."""
        # Get real IP (handles proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Add user ID if authenticated
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{client_ip}"
    
    async def _is_rate_limited(self, key: str) -> Tuple[bool, int]:
        """
        Check if request should be rate limited.
        Returns (is_limited, remaining_requests).
        """
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        async with self._lock:
            # Clean old entries
            self._requests[key] = [
                ts for ts in self._requests[key] 
                if ts > window_start
            ]
            
            # Check limit
            request_count = len(self._requests[key])
            if request_count >= self.max_requests:
                return True, 0
            
            # Add current request
            self._requests[key].append(now)
            return False, self.max_requests - request_count - 1
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks and public paths
        path = request.url.path
        if path in ["/health", "/", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        client_key = self._get_client_key(request)
        is_limited, remaining = await self._is_rate_limited(client_key)
        
        if is_limited:
            logger.warning(f"Rate limit exceeded for {client_key}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(self.window_seconds)
                }
            )
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(self.window_seconds)
        
        return response
