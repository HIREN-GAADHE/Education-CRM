"""
Examination and gradebook schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import UUID


class ExamTypeEnum(str, Enum):
    UNIT_TEST = "unit_test"
    MIDTERM = "midterm"
    FINAL = "final"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    PRACTICAL = "practical"
    ORAL = "oral"
    INTERNAL = "internal"


class ExamStatusEnum(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    RESULTS_PENDING = "results_pending"
    RESULTS_PUBLISHED = "results_published"
    CANCELLED = "cancelled"


# ============== Grade Scale Schemas ==============

class GradeLevelBase(BaseModel):
    """Base schema for grade level."""
    grade: str = Field(..., max_length=10)
    grade_point: Optional[float] = None
    min_value: float
    max_value: float
    description: Optional[str] = None
    color: Optional[str] = None
    order: int = 0


class GradeLevelResponse(GradeLevelBase):
    """Schema for grade level response."""
    id: UUID
    scale_id: UUID
    
    class Config:
        from_attributes = True


class GradeScaleBase(BaseModel):
    """Base schema for grade scale."""
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    scale_type: str = "percentage"
    academic_year: Optional[str] = None
    is_default: bool = False


class GradeScaleCreate(GradeScaleBase):
    """Schema for creating a grade scale with levels."""
    levels: List[GradeLevelBase] = []


class GradeScaleResponse(GradeScaleBase):
    """Schema for grade scale response."""
    id: UUID
    tenant_id: UUID
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class GradeScaleDetailResponse(GradeScaleResponse):
    """Detailed grade scale with levels."""
    levels: List[GradeLevelResponse] = []


# ============== Examination Schemas ==============

class ExaminationCreate(BaseModel):
    """Schema for creating an examination. Accepts string dates from frontend."""
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    exam_type: str = "unit_test"
    course_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    exam_date: Optional[str] = None  # Accept string from frontend (e.g., "2025-01-17")
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    room_id: Optional[UUID] = None
    venue: Optional[str] = None
    max_marks: float = 100
    passing_marks: Optional[float] = None
    weightage: float = 100
    grade_scale_id: Optional[UUID] = None
    instructions: Optional[str] = None


class ExaminationUpdate(BaseModel):
    """Schema for updating an examination."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    exam_date: Optional[str] = None  # Accept string from frontend
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    venue: Optional[str] = None
    max_marks: Optional[float] = None
    passing_marks: Optional[float] = None
    instructions: Optional[str] = None
    status: Optional[ExamStatusEnum] = None


class ExaminationResponse(BaseModel):
    """Schema for examination response. Uses datetime for proper serialization."""
    id: UUID
    tenant_id: UUID
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    exam_type: str
    course_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    exam_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    room_id: Optional[UUID] = None
    venue: Optional[str] = None
    max_marks: float = 100
    passing_marks: Optional[float] = None
    weightage: float = 100
    grade_scale_id: Optional[UUID] = None
    instructions: Optional[str] = None
    status: ExamStatusEnum
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExaminationListResponse(BaseModel):
    """Schema for list of examinations."""
    items: List[ExaminationResponse]
    total: int
    page: int
    page_size: int


# ============== Exam Result Schemas ==============

class ExamResultBase(BaseModel):
    """Base schema for exam result."""
    student_id: UUID
    marks_obtained: Optional[float] = None
    is_absent: bool = False
    is_exempted: bool = False
    exemption_reason: Optional[str] = None
    remarks: Optional[str] = None


class ExamResultCreate(ExamResultBase):
    """Schema for creating/entering an exam result."""
    pass


class BulkExamResultCreate(BaseModel):
    """Schema for bulk entering exam results."""
    results: List[ExamResultCreate]


class ExamResultResponse(BaseModel):
    """Schema for exam result response."""
    id: UUID
    examination_id: UUID
    student_id: UUID
    marks_obtained: Optional[float] = None
    grade: Optional[str] = None
    grade_point: Optional[float] = None
    percentage: Optional[float] = None
    is_absent: bool
    is_exempted: bool
    remarks: Optional[str] = None
    verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExamResultDetailResponse(ExamResultResponse):
    """Detailed exam result with student info."""
    student_name: Optional[str] = None
    student_roll_number: Optional[str] = None


class ExamResultListResponse(BaseModel):
    """Schema for list of exam results."""
    items: List[ExamResultDetailResponse]
    total: int
    
    # Statistics
    average_marks: Optional[float] = None
    highest_marks: Optional[float] = None
    lowest_marks: Optional[float] = None
    pass_count: int = 0
    fail_count: int = 0
    absent_count: int = 0


# ============== GPA/Transcript Schemas ==============

class StudentGPAResponse(BaseModel):
    """Schema for student GPA response."""
    student_id: UUID
    academic_year: str
    term: Optional[str] = None
    gpa: Optional[float] = None
    cgpa: Optional[float] = None
    total_credits: float
    earned_credits: float
    rank_in_class: Optional[int] = None
    rank_in_section: Optional[int] = None
    
    class Config:
        from_attributes = True


class TranscriptExamEntry(BaseModel):
    """Single exam entry in transcript."""
    exam_name: str
    exam_type: str
    subject_name: Optional[str] = None
    max_marks: float
    marks_obtained: Optional[float] = None
    grade: Optional[str] = None
    grade_point: Optional[float] = None
    percentage: Optional[float] = None
    status: str  # pass, fail, absent, exempted


class TranscriptTermEntry(BaseModel):
    """Term entry in transcript."""
    term: str
    exams: List[TranscriptExamEntry]
    term_gpa: Optional[float] = None
    total_marks: float
    obtained_marks: float
    percentage: float


class TranscriptResponse(BaseModel):
    """Complete student transcript."""
    student_id: UUID
    student_name: str
    student_roll_number: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    academic_year: str
    terms: List[TranscriptTermEntry]
    overall_gpa: Optional[float] = None
    cgpa: Optional[float] = None
    overall_percentage: float
    overall_grade: Optional[str] = None
    rank_in_class: Optional[int] = None
    generated_at: datetime


# ============== Statistics Schemas ==============

class ExamStatisticsResponse(BaseModel):
    """Exam statistics response."""
    exam_id: UUID
    exam_name: str
    total_students: int
    appeared: int
    absent: int
    exempted: int
    passed: int
    failed: int
    pass_percentage: float
    average_marks: float
    highest_marks: float
    lowest_marks: float
    median_marks: Optional[float] = None
    standard_deviation: Optional[float] = None
    grade_distribution: Dict[str, int] = {}
    marks_distribution: List[Dict[str, Any]] = []  # For histogram
