"""
Student Model - Core student entity for the Education ERP
"""
from sqlalchemy import Column, String, Date, Text, Enum, Integer, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class StudentStatus(str, enum.Enum):
    APPLICANT = "applicant"
    ENROLLED = "enrolled"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    GRADUATED = "graduated"
    DROPPED = "dropped"
    TRANSFERRED = "transferred"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Student(TenantBaseModel, SoftDeleteMixin):
    """
    Student entity - represents a student enrolled in the institution.
    """
    __tablename__ = "students"
    
    # Basic Information
    admission_number = Column(String(50), nullable=False, index=True)
    roll_number = Column(String(50), nullable=True)
    
    # User account link (for student self-service portal login)
    # TODO: Uncomment after running: ALTER TABLE students ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    # user_id = Column(
    #     UUID(as_uuid=True), 
    #     ForeignKey("users.id", ondelete="SET NULL"), 
    #     nullable=True,
    #     index=True
    # )
    
    # Personal Details
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    blood_group = Column(String(20), nullable=True)
    nationality = Column(String(50), default="Indian")
    religion = Column(String(50), nullable=True)
    caste = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True)  # General, OBC, SC, ST, etc.
    
    # Contact Information
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    country = Column(String(100), default="India")
    
    parent_email = Column(String(255), nullable=True)
    father_name = Column(String(200), nullable=True)
    father_phone = Column(String(20), nullable=True)
    father_occupation = Column(String(100), nullable=True)
    mother_name = Column(String(200), nullable=True)
    mother_phone = Column(String(20), nullable=True)
    mother_occupation = Column(String(100), nullable=True)
    guardian_name = Column(String(200), nullable=True)
    guardian_phone = Column(String(20), nullable=True)
    guardian_relation = Column(String(50), nullable=True)
    
    # Academic Information
    course = Column(String(100), nullable=True)  # Will be FK to courses table later
    department = Column(String(100), nullable=True)
    batch = Column(String(50), nullable=True)  # e.g., "2023-2027"
    section = Column(String(50), nullable=True)
    semester = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)  # Current year of study
    
    # Class Link (Standard/Section)
    class_id = Column(UUID(as_uuid=True), ForeignKey("school_classes.id"), nullable=True, index=True)
    school_class = relationship("SchoolClass", back_populates="students")
    
    # Admission Details
    admission_date = Column(Date, nullable=True)
    admission_type = Column(String(50), nullable=True)  # Regular, Lateral, Management
    
    # Status
    status = Column(Enum(StudentStatus), default=StudentStatus.ACTIVE)
    
    # Photo
    avatar_url = Column(String(500), nullable=True)
    
    # Extra Data (for custom fields)
    extra_data = Column(JSONB, default={})
    
    # Relationships
    # user = relationship("User", foreign_keys=[user_id])  # TODO: Uncomment after migration
    fee_payments = relationship("FeePayment", back_populates="student", lazy="dynamic")
    parent_links = relationship("ParentStudent", back_populates="student", lazy="select")
    
    @property
    def full_name(self) -> str:
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return " ".join(parts)
    
    def __repr__(self):
        return f"<Student {self.admission_number}: {self.full_name}>"

