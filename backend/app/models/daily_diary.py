"""
Daily Diary / Behavior Tracking Models
"""
import enum
from sqlalchemy import Column, String, Date, Boolean, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import TenantBaseModel, SoftDeleteMixin


class MoodType(str, enum.Enum):
    HAPPY = "happy"
    NEUTRAL = "neutral"
    SAD = "sad"
    ANGRY = "angry"
    ANXIOUS = "anxious"
    EXCITED = "excited"


class DailyDiary(TenantBaseModel, SoftDeleteMixin):
    """
    Daily mood & behavior entry created by a teacher for a student.
    One entry per student per day (enforced by unique constraint).
    """
    __tablename__ = "daily_diary"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"),
                        nullable=True, index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                         nullable=True)

    entry_date = Column(Date, nullable=False, index=True)
    mood = Column(String(20), nullable=True)           # MoodType enum value
    behavior_score = Column(Integer, nullable=True)   # 1 (poor) – 5 (excellent)
    attendance_status = Column(String(20), nullable=True)  # present/absent/late

    academic_notes = Column(Text, nullable=True)      # classwork, participation
    behavior_notes = Column(Text, nullable=True)      # conduct, incidents
    homework_status = Column(String(50), nullable=True)  # completed/incomplete/partial
    homework_notes = Column(Text, nullable=True)

    is_shared_with_parent = Column(Boolean, default=True, nullable=False)
    parent_acknowledged = Column(Boolean, default=False, nullable=False)
    parent_acknowledged_at = Column(DateTime, nullable=True)

    student = relationship("Student", foreign_keys=[student_id], lazy="joined")
    teacher = relationship("Staff", foreign_keys=[teacher_id], lazy="joined")
