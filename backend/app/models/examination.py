"""
Examination and gradebook models.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Float, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.models.base import TenantBaseModel, TimestampMixin


class ExamType(str, enum.Enum):
    """Exam type enumeration."""
    UNIT_TEST = "unit_test"
    MIDTERM = "midterm"
    FINAL = "final"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    PRACTICAL = "practical"
    ORAL = "oral"
    INTERNAL = "internal"


class ExamStatus(str, enum.Enum):
    """Exam status enumeration."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    RESULTS_PENDING = "results_pending"
    RESULTS_PUBLISHED = "results_published"
    CANCELLED = "cancelled"


class GradeScale(TenantBaseModel, TimestampMixin):
    """
    Grade scale for converting marks to grades.
    """
    __tablename__ = "grade_scales"
    
    # Identification
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    
    # Scale type
    scale_type = Column(String(50), default="percentage")  # percentage, points
    
    # Academic year
    academic_year = Column(String(20), nullable=True)
    
    # Is this the default scale
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    grades = relationship("GradeLevel", back_populates="scale", lazy="dynamic")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='uq_grade_scale_tenant_code'),
    )
    
    def __repr__(self):
        return f"<GradeScale {self.name}>"


class GradeLevel(TenantBaseModel):
    """
    Individual grade level within a scale.
    """
    __tablename__ = "grade_levels"
    
    scale_id = Column(UUID(as_uuid=True), ForeignKey("grade_scales.id", ondelete="CASCADE"), nullable=False)
    
    # Grade info
    grade = Column(String(10), nullable=False)  # A+, A, B+, etc.
    grade_point = Column(Float, nullable=True)  # 4.0, 3.7, etc.
    
    # Range (percentage or points)
    min_value = Column(Float, nullable=False)
    max_value = Column(Float, nullable=False)
    
    # Display
    description = Column(String(100), nullable=True)  # "Excellent", "Good", etc.
    color = Column(String(7), nullable=True)  # Hex color for display
    
    # Order for display
    order = Column(Integer, default=0)
    
    # Relationships
    scale = relationship("GradeScale", back_populates="grades")
    
    def __repr__(self):
        return f"<GradeLevel {self.grade} ({self.min_value}-{self.max_value})>"


class Examination(TenantBaseModel, TimestampMixin):
    """
    Examination model representing an exam or assessment.
    """
    __tablename__ = "examinations"
    
    # Identification
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    
    # Type
    exam_type = Column(SQLEnum(ExamType), nullable=False, index=True)
    
    # Course/Subject
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True, index=True)
    subject_name = Column(String(200), nullable=True)  # Alternative to course_id
    
    # Class/Section
    class_name = Column(String(100), nullable=True, index=True)
    section = Column(String(50), nullable=True)
    
    # Academic period
    academic_year = Column(String(20), nullable=True, index=True)
    term = Column(String(50), nullable=True)
    
    # Schedule
    exam_date = Column(DateTime, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    
    # Venue
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)
    venue = Column(String(200), nullable=True)
    
    # Marks
    max_marks = Column(Float, nullable=False, default=100)
    passing_marks = Column(Float, nullable=True)
    weightage = Column(Float, default=100)  # Percentage weightage in final grade
    
    # Grade scale
    grade_scale_id = Column(UUID(as_uuid=True), ForeignKey("grade_scales.id"), nullable=True)
    
    # Instructions
    instructions = Column(Text, nullable=True)
    
    # Status
    status = Column(SQLEnum(ExamStatus), default=ExamStatus.DRAFT, index=True)
    
    # Created by
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Extra data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    course = relationship("Course", foreign_keys=[course_id])
    grade_scale = relationship("GradeScale", foreign_keys=[grade_scale_id])
    results = relationship("ExamResult", back_populates="examination", lazy="dynamic")
    
    def __repr__(self):
        return f"<Examination {self.name}>"
    
    @property
    def is_published(self) -> bool:
        """Check if results are published."""
        return self.status == ExamStatus.RESULTS_PUBLISHED


class ExamResult(TenantBaseModel, TimestampMixin):
    """
    Individual exam result for a student.
    """
    __tablename__ = "exam_results"
    
    # References
    examination_id = Column(UUID(as_uuid=True), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Marks
    marks_obtained = Column(Float, nullable=True)
    
    # Grade (calculated)
    grade = Column(String(10), nullable=True)
    grade_point = Column(Float, nullable=True)
    
    # Percentage
    percentage = Column(Float, nullable=True)
    
    # Status
    is_absent = Column(Boolean, default=False)
    is_exempted = Column(Boolean, default=False)
    exemption_reason = Column(String(500), nullable=True)
    
    # Remarks
    remarks = Column(String(500), nullable=True)
    
    # Verification
    verified = Column(Boolean, default=False)
    verified_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Entry tracking
    entered_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, default=datetime.utcnow)
    modified_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    modified_at = Column(DateTime, nullable=True)
    
    # Relationships
    examination = relationship("Examination", back_populates="results")
    student = relationship("Student", foreign_keys=[student_id])
    
    __table_args__ = (
        UniqueConstraint('examination_id', 'student_id', name='uq_exam_result_exam_student'),
    )
    
    def __repr__(self):
        return f"<ExamResult exam={self.examination_id} student={self.student_id}>"
    
    def calculate_percentage(self, max_marks: float) -> float:
        """Calculate percentage."""
        if not self.marks_obtained or max_marks == 0:
            return 0
        return (self.marks_obtained / max_marks) * 100
    
    def calculate_grade(self, grade_levels: list) -> tuple:
        """
        Calculate grade from percentage.
        Returns (grade, grade_point)
        """
        if not self.percentage:
            return None, None
        
        for level in sorted(grade_levels, key=lambda x: x.min_value, reverse=True):
            if level.min_value <= self.percentage <= level.max_value:
                return level.grade, level.grade_point
        
        return None, None


class StudentGPA(TenantBaseModel, TimestampMixin):
    """
    Calculated GPA for a student per term/year.
    """
    __tablename__ = "student_gpas"
    
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Period
    academic_year = Column(String(20), nullable=False)
    term = Column(String(50), nullable=True)
    
    # GPA values
    gpa = Column(Float, nullable=True)  # Term GPA
    cgpa = Column(Float, nullable=True)  # Cumulative GPA
    
    # Credit info
    total_credits = Column(Float, default=0)
    earned_credits = Column(Float, default=0)
    
    # Rank
    rank_in_class = Column(Integer, nullable=True)
    rank_in_section = Column(Integer, nullable=True)
    
    # Status
    is_calculated = Column(Boolean, default=False)
    calculated_at = Column(DateTime, nullable=True)
    
    # Relationships
    student = relationship("Student", foreign_keys=[student_id])
    
    __table_args__ = (
        UniqueConstraint('student_id', 'academic_year', 'term', name='uq_student_gpa_period'),
    )
    
    def __repr__(self):
        return f"<StudentGPA student={self.student_id} gpa={self.gpa}>"
