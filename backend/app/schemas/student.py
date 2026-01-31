"""
Student Schemas - Pydantic models for Student API
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
from enum import Enum


class StudentStatus(str, Enum):
    APPLICANT = "applicant"
    ENROLLED = "enrolled"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    GRADUATED = "graduated"
    DROPPED = "dropped"
    TRANSFERRED = "transferred"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class StudentBase(BaseModel):
    admission_number: str = Field(..., min_length=1, max_length=50)
    roll_number: Optional[str] = Field(None, max_length=50)
    
    # Personal
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = Field(None, max_length=50)  # Increased to handle legacy data
    nationality: Optional[str] = Field("Indian", max_length=50)
    religion: Optional[str] = Field(None, max_length=50)
    caste: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    
    # Contact
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    alternate_phone: Optional[str] = Field(None, max_length=20)
    
    # Address
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field("India", max_length=100)
    
    # Parent/Guardian
    parent_email: Optional[EmailStr] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    mother_occupation: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relation: Optional[str] = None
    
    # Academic
    course: Optional[str] = None
    class_id: Optional[UUID] = None  # Link to SchoolClass
    department: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[int] = None
    year: Optional[int] = None
    
    # Admission
    admission_date: Optional[date] = None
    admission_type: Optional[str] = None
    
    # Status
    status: Optional[StudentStatus] = StudentStatus.ACTIVE
    
    # Photo
    avatar_url: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    admission_number: Optional[str] = None
    roll_number: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    nationality: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    category: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    parent_email: Optional[EmailStr] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    mother_occupation: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relation: Optional[str] = None
    course: Optional[str] = None
    class_id: Optional[UUID] = None
    class_name: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[int] = None
    year: Optional[int] = None
    admission_date: Optional[date] = None
    admission_type: Optional[str] = None
    status: Optional[StudentStatus] = None
    avatar_url: Optional[str] = None


class StudentResponse(StudentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    items: List[StudentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StudentImportError(BaseModel):
    """Individual import error details."""
    row: int
    field: Optional[str] = None
    message: str


class StudentImportResult(BaseModel):
    """Result of student import operation."""
    total_rows: int
    successful: int
    failed: int
    errors: List[StudentImportError] = []
    imported_ids: List[UUID] = []

