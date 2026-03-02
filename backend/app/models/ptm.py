"""
PTM (Parent-Teacher Meeting) Models
"""
import enum
from sqlalchemy import Column, String, Date, Time, Boolean, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import TenantBaseModel, SoftDeleteMixin


class PTMSessionStatus(str, enum.Enum):
    REQUESTED = "requested"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PTMReviewerType(str, enum.Enum):
    TEACHER = "teacher"
    PARENT = "parent"


class PTMSlot(TenantBaseModel, SoftDeleteMixin):
    """A time slot created by a teacher indicating their availability for PTM."""
    __tablename__ = "ptm_slots"

    teacher_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_booked = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    teacher = relationship("Staff", foreign_keys=[teacher_id], lazy="joined")
    sessions = relationship("PTMSession", back_populates="slot", lazy="dynamic")


class PTMSession(TenantBaseModel, SoftDeleteMixin):
    """A booked PTM session — links a slot with a student and parent."""
    __tablename__ = "ptm_sessions"

    slot_id = Column(UUID(as_uuid=True), ForeignKey("ptm_slots.id", ondelete="SET NULL"), nullable=True, index=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    scheduled_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=15)
    status = Column(String(20), default=PTMSessionStatus.SCHEDULED, nullable=False, index=True)
    meeting_link = Column(String(500), nullable=True)
    reason = Column(Text, nullable=True)

    slot = relationship("PTMSlot", back_populates="sessions")
    teacher = relationship("Staff", foreign_keys=[teacher_id], lazy="joined")
    student = relationship("Student", foreign_keys=[student_id], lazy="joined")
    remarks = relationship("PTMRemark", back_populates="session", lazy="dynamic")


class PTMRemark(TenantBaseModel):
    """Post-meeting remark/note added by teacher or parent."""
    __tablename__ = "ptm_remarks"

    session_id = Column(UUID(as_uuid=True), ForeignKey("ptm_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    author_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author_type = Column(String(10), default=PTMReviewerType.TEACHER, nullable=False)
    content = Column(Text, nullable=False)
    is_private = Column(Boolean, default=False)

    session = relationship("PTMSession", back_populates="remarks")
