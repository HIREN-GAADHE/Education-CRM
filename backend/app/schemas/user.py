"""
User Schemas - Pydantic models for User API
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum


class UserStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class RoleBasic(BaseModel):
    """Basic role information for user responses."""
    id: UUID
    name: str
    display_name: str
    level: int
    
    class Config:
        from_attributes = True


# Alias for backwards compatibility
RoleInfo = RoleBasic


class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    username: Optional[str] = None
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = None
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[datetime] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str = Field(..., min_length=8)
    status: Optional[UserStatus] = UserStatus.ACTIVE
    role_ids: Optional[List[UUID]] = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[datetime] = None
    status: Optional[UserStatus] = None
    avatar_url: Optional[str] = None


class UserInDB(UserBase):
    """User schema with database fields (for internal use)."""
    id: UUID
    tenant_id: UUID
    status: UserStatus
    password_hash: str
    email_verified: bool = False
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """Schema for user API responses."""
    id: UUID
    tenant_id: Optional[UUID] = None
    email: str
    username: Optional[str] = None
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[datetime] = None
    status: UserStatus
    avatar_url: Optional[str] = None
    email_verified: bool = False
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    roles: List[RoleBasic] = []
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Paginated list of users."""
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserPasswordUpdate(BaseModel):
    """Schema for password update."""
    current_password: str
    new_password: str = Field(..., min_length=8)


class AssignRoleRequest(BaseModel):
    """Schema for assigning roles to a user."""
    role_ids: List[UUID]


# Alias for backwards compatibility
UserRoleAssignment = AssignRoleRequest
