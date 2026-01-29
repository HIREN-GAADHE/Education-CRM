"""
Parent-Student Relationship Model
Links parent user accounts to student records for portal access.
"""
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import TenantBaseModel


class RelationshipType(str, enum.Enum):
    """Parent/Guardian relationship types."""
    FATHER = "father"
    MOTHER = "mother"
    GUARDIAN = "guardian"
    GRANDPARENT = "grandparent"
    SIBLING = "sibling"
    OTHER = "other"


class ParentStudent(TenantBaseModel):
    """
    Links parent users to student records.
    A parent can have multiple children (students).
    A student can have multiple parent accounts linked.
    """
    __tablename__ = "parent_students"
    
    # Parent user (must have parent role)
    parent_user_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    # Student record
    student_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("students.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    # Relationship details
    relationship_type = Column(
        SQLEnum(RelationshipType),
        default=RelationshipType.GUARDIAN,
        nullable=False
    )
    
    # Contact preferences
    is_primary_contact = Column(Boolean, default=False)
    can_receive_notifications = Column(Boolean, default=True)
    can_receive_sms = Column(Boolean, default=True)
    can_receive_email = Column(Boolean, default=True)
    
    # Access permissions
    can_view_attendance = Column(Boolean, default=True)
    can_view_grades = Column(Boolean, default=True)
    can_view_fees = Column(Boolean, default=True)
    can_pay_fees = Column(Boolean, default=True)
    can_view_timetable = Column(Boolean, default=True)
    can_download_certificates = Column(Boolean, default=True)
    
    # Relationships
    parent_user = relationship("User", foreign_keys=[parent_user_id])
    student = relationship("Student", back_populates="parent_links")
    
    # Unique constraint: one parent-student link per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'parent_user_id', 'student_id', name='uq_parent_student_link'),
    )
    
    def __repr__(self):
        return f"<ParentStudent parent={self.parent_user_id} student={self.student_id}>"
