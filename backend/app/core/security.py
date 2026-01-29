from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets
import hashlib

from app.config.settings import settings


class PasswordService:
    """Service for password hashing and validation."""
    
    def __init__(self):
        self.pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__rounds=settings.PASSWORD_HASH_ROUNDS
        )
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def validate_password_strength(self, password: str) -> Tuple[bool, List[str]]:
        """
        Validate password strength.
        Returns (is_valid, list_of_errors).
        """
        errors = []
        
        if len(password) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")
        
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            errors.append("Password must contain at least one special character")
        
        return len(errors) == 0, errors


class TokenService:
    """Service for JWT token operations."""
    
    def __init__(self):
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        self.refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    def create_access_token(
        self,
        user_id: str,
        tenant_id: str,
        roles: List[str],
        permissions: List[str],
        role_level: int = 99,
        additional_claims: Optional[dict] = None
    ) -> str:
        """
        Create a new access token.
        
        Args:
            user_id: User's UUID
            tenant_id: Tenant's UUID
            roles: List of role names
            permissions: List of permission codes
            role_level: User's highest privilege level (0=Super Admin, 4=User)
            additional_claims: Optional additional JWT claims
        
        Returns:
            Encoded JWT token
        """
        now = datetime.utcnow()
        expire = now + self.access_token_expires
        
        payload = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "roles": roles,
            "permissions": permissions,
            "role_level": role_level,
            "type": "access",
            "iat": now,
            "exp": expire,
            "jti": secrets.token_urlsafe(16)  # Unique token ID
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(
        self,
        user_id: str,
        tenant_id: str
    ) -> Tuple[str, str, datetime]:
        """
        Create a new refresh token.
        
        Returns:
            Tuple of (token, token_hash, expires_at)
        """
        now = datetime.utcnow()
        expire = now + self.refresh_token_expires
        
        payload = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "type": "refresh",
            "iat": now,
            "exp": expire,
            "jti": secrets.token_urlsafe(32)
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        token_hash = self._hash_token(token)
        
        return token, token_hash, expire
    
    def decode_token(self, token: str) -> Optional[dict]:
        """
        Decode and validate a JWT token.
        
        Returns:
            Decoded payload or None if invalid
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
        except JWTError:
            return None
    
    def verify_token_type(self, token: str, expected_type: str) -> Optional[dict]:
        """
        Verify token and check its type.
        
        Args:
            token: JWT token
            expected_type: Expected token type ("access" or "refresh")
        
        Returns:
            Decoded payload if valid and type matches, None otherwise
        """
        payload = self.decode_token(token)
        if not payload:
            return None
        
        if payload.get("type") != expected_type:
            return None
        
        return payload
    
    def _hash_token(self, token: str) -> str:
        """Create a hash of the token for storage."""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def verify_token_hash(self, token: str, stored_hash: str) -> bool:
        """Verify a token against its stored hash."""
        return self._hash_token(token) == stored_hash


class SecurityService:
    """Unified security service combining password and token services."""
    
    def __init__(self):
        self.password_service = PasswordService()
        self.token_service = TokenService()
    
    # Password methods
    def hash_password(self, password: str) -> str:
        return self.password_service.hash_password(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self.password_service.verify_password(plain_password, hashed_password)
    
    def validate_password_strength(self, password: str) -> Tuple[bool, List[str]]:
        return self.password_service.validate_password_strength(password)
    
    # Token methods
    def create_access_token(self, **kwargs) -> str:
        return self.token_service.create_access_token(**kwargs)
    
    def create_refresh_token(self, **kwargs) -> Tuple[str, str, datetime]:
        return self.token_service.create_refresh_token(**kwargs)
    
    def decode_token(self, token: str) -> Optional[dict]:
        return self.token_service.decode_token(token)
    
    def verify_access_token(self, token: str) -> Optional[dict]:
        return self.token_service.verify_token_type(token, "access")
    
    def verify_refresh_token(self, token: str) -> Optional[dict]:
        return self.token_service.verify_token_type(token, "refresh")


# Global security service instance
security = SecurityService()
