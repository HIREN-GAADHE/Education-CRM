from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    remember_me: bool = False


class LoginResponse(BaseModel):
    """Login response schema."""
    access_token: str
    # refresh_token: str  # Removed: Set in HttpOnly cookie
    token_type: str = "bearer"
    expires_in: int
    user: "UserBasic"


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    refresh_token: Optional[str] = None # Optional as we prioritize cookie


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ForgotPasswordRequest(BaseModel):
    """Forgot password request schema."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password request schema."""
    token: str
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class ChangePasswordRequest(BaseModel):
    """Change password request schema."""
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class VerifyEmailRequest(BaseModel):
    """Email verification request schema."""
    token: str


class UserBasic(BaseModel):
    """Basic user information for token response."""
    id: str
    email: str
    first_name: str
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    roles: List[str] = []
    role_level: int = 99
    restricted_modules: List[str] = []  # Tenant's restricted modules
    allowed_modules: List[str] = []  # Role's allowed modules
    
    class Config:
        from_attributes = True




# Update forward reference
LoginResponse.model_rebuild()
