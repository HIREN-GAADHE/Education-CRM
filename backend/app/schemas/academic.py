from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

class SchoolClassBase(BaseModel):
    name: str = Field(..., description="Class name (e.g. 10, X)")
    section: str = Field(..., description="Section (e.g. A, B)")
    capacity: Optional[int] = 40
    class_teacher_id: Optional[UUID] = None

class SchoolClassCreate(SchoolClassBase):
    pass

class SchoolClassUpdate(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    capacity: Optional[int] = None
    class_teacher_id: Optional[UUID] = None

class SchoolClassResponse(SchoolClassBase):
    id: UUID
    tenant_id: UUID
    student_count: int = 0  # Number of students in this class
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
