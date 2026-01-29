"""
Attendance Model - Student and Staff attendance tracking
"""
from sqlalchemy import Column, String, Date, Time, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"
    HOLIDAY = "holiday"


class AttendanceType(str, enum.Enum):
    STUDENT = "student"
    STAFF = "staff"


class Attendance(TenantBaseModel, SoftDeleteMixin):
    """
    Attendance record for students and staff.
    Supports soft delete to maintain audit trail.
    """
    __tablename__ = "attendance"
    
    # Type
    attendance_type = Column(Enum(AttendanceType), nullable=False)
    
    # Reference (student_id or staff_id)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Date and Time
    attendance_date = Column(Date, nullable=False, index=True)
    check_in_time = Column(Time, nullable=True)
    check_out_time = Column(Time, nullable=True)
    
    # Status
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    
    # Academic context
    course = Column(String(100), nullable=True)
    section = Column(String(20), nullable=True)
    subject = Column(String(100), nullable=True)
    period = Column(String(20), nullable=True)
    
    # Remarks
    remarks = Column(Text, nullable=True)
    
    # Marked by
    marked_by = Column(UUID(as_uuid=True), nullable=True)  # User who marked
    
    # Extra Data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    student = relationship("Student", foreign_keys=[student_id], lazy="select")
    
    def __repr__(self):
        return f"<Attendance {self.attendance_date} - {self.status}>"
