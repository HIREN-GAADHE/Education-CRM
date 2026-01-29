"""
Request ID Middleware - Adds unique request ID for distributed tracing.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import uuid
import logging


logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that assigns a unique ID to each request for tracing.
    The ID is available in request.state.request_id and returned in X-Request-ID header.
    """
    
    HEADER_NAME = "X-Request-ID"
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if request already has an ID (from upstream proxy/load balancer)
        request_id = request.headers.get(self.HEADER_NAME)
        
        if not request_id:
            request_id = str(uuid.uuid4())
        
        # Make available to the application
        request.state.request_id = request_id
        
        # Configure logging to include request ID
        # This affects all log messages during this request
        old_factory = logging.getLogRecordFactory()
        
        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.request_id = request_id
            return record
        
        logging.setLogRecordFactory(record_factory)
        
        try:
            response = await call_next(request)
        finally:
            # Reset logging factory
            logging.setLogRecordFactory(old_factory)
        
        # Add request ID to response headers
        response.headers[self.HEADER_NAME] = request_id
        
        return response
