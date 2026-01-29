"""
Staff Model - Personnel/Employee entity for the Education ERP
"""
from sqlalchemy import Column, String, Date, Text, Enum, Integer, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class StaffStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"
    RETIRED = "retired"


class StaffType(str, enum.Enum):
    TEACHING = "teaching"
    NON_TEACHING = "non_teaching"
    ADMINISTRATIVE = "administrative"
    SUPPORT = "support"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


from sqlalchemy import Table, ForeignKey

# Association table for Staff <-> SchoolClass (Many-to-Many)
staff_classes = Table(
    "staff_classes",
    TenantBaseModel.metadata,
    Column("staff_id", UUID(as_uuid=True), ForeignKey("staff.id"), primary_key=True),
    Column("class_id", UUID(as_uuid=True), ForeignKey("school_classes.id"), primary_key=True),
)


class Staff(TenantBaseModel, SoftDeleteMixin):
    """
    Staff entity - represents an employee (teacher, admin, support staff).
    """
    __tablename__ = "staff"
    
    # Relationships
    associated_classes = relationship("SchoolClass", secondary=staff_classes, backref="teachers")
    
    # Employee ID
    employee_id = Column(String(50), nullable=False, index=True)
    
    # Personal Details
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    
    # Contact Information
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    
    # Address
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    
    # Employment Details
    staff_type = Column(Enum(StaffType), default=StaffType.TEACHING)
    designation = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    qualification = Column(String(200), nullable=True)
    specialization = Column(String(200), nullable=True)
    experience_years = Column(Integer, nullable=True)
    
    # Joining Details
    joining_date = Column(Date, nullable=True)
    confirmation_date = Column(Date, nullable=True)
    
    # Salary Information
    basic_salary = Column(Float, nullable=True)
    
    # Status
    status = Column(Enum(StaffStatus), default=StaffStatus.ACTIVE)
    
    # Photo
    avatar_url = Column(String(500), nullable=True)
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    @property
    def full_name(self) -> str:
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return " ".join(parts)
    
    def __repr__(self):
        return f"<Staff {self.employee_id}: {self.full_name}>"
