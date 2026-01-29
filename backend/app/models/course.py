"""
Course Model - Manages academic courses
"""
from sqlalchemy import Column, String, Integer, Text, Date, Boolean, Enum as SQLEnum, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import TenantBaseModel, SoftDeleteMixin


class CourseStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UPCOMING = "upcoming"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Course(TenantBaseModel, SoftDeleteMixin):
    """Course model for managing academic courses."""
    
    __tablename__ = "courses"
    
    # Basic Info
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Department and Category
    department = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    
    # Duration and Schedule
    duration_months = Column(Integer, nullable=True, default=4)
    credits = Column(Integer, nullable=True, default=3)
    
    # Capacity
    max_students = Column(Integer, nullable=True, default=50)
    enrolled_count = Column(Integer, nullable=True, default=0)
    
    # Fees
    fee_amount = Column(Float, nullable=True, default=0.0)
    
    # Status and Progress
    status = Column(SQLEnum(CourseStatus), default=CourseStatus.ACTIVE)
    progress = Column(Integer, nullable=True, default=0)  # 0-100 percentage
    
    # Instructor
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True)
    instructor_name = Column(String(255), nullable=True)
    
    # Dates
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    # Settings
    is_mandatory = Column(Boolean, default=False)
    color = Column(String(20), nullable=True, default="#667eea")
    
    def __repr__(self):
        return f"<Course {self.code}: {self.name}>"
