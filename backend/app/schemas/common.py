from typing import Optional, List, Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar('T')


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    environment: str


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: str


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error_code: str
    message: str
    details: Optional[Any] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response."""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = 1
    page_size: int = 20
    sort_by: Optional[str] = None
    sort_order: str = "asc"  # asc or desc


class SearchParams(BaseModel):
    """Search parameters."""
    query: Optional[str] = None
    filters: Optional[dict] = None


class BulkOperationRequest(BaseModel):
    """Request for bulk operations."""
    ids: List[str]
    action: str
    params: Optional[dict] = None


class BulkOperationResponse(BaseModel):
    """Response for bulk operations."""
    total: int
    success: int
    failed: int
    errors: List[dict] = []
