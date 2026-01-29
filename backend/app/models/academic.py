"""
Academic Models - School Class/Standard Management
"""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin

class SchoolClass(TenantBaseModel, SoftDeleteMixin):
    """
    School Class entity (e.g., Class X-A, Grade 5-B).
    Represents a specific section of a standard/grade.
    """
    __tablename__ = "school_classes"

    name = Column(String(50), nullable=False)  # e.g., "X", "10", "Kindergarten"
    section = Column(String(10), nullable=False)  # e.g., "A", "B", "Red"
    
    # Optional: Link to a specific academic year/session if needed later, 
    # but for now keeping it simple as per requirement.

    capacity = Column(Integer, default=40)
    
    # Class Teacher (One-to-One roughly, but a staff can be class teacher of mult classes theoretically)
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True)
    
    # Relationships
    class_teacher = relationship("Staff", foreign_keys=[class_teacher_id], backref="class_teacher_of")
    students = relationship("Student", back_populates="school_class")
    
    # For Subject Teachers (Many-to-Many)
    # defined in staff.py or via association object
    
    def __repr__(self):
        return f"<SchoolClass {self.name}-{self.section}>"
