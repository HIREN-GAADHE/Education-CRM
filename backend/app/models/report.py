"""
Report Model - Report generation and storage for the Education ERP
"""
from sqlalchemy import Column, String, Text, Enum, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum

from app.models.base import TenantBaseModel


class ReportType(str, enum.Enum):
    STUDENT_LIST = "student_list"
    ATTENDANCE_SUMMARY = "attendance_summary"
    FEE_COLLECTION = "fee_collection"
    FEE_DEFAULTERS = "fee_defaulters"
    STAFF_LIST = "staff_list"
    EXAM_RESULTS = "exam_results"
    CUSTOM = "custom"


class ReportFormat(str, enum.Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Report(TenantBaseModel):
    """
    Generated report entity.
    """
    __tablename__ = "reports"
    
    # Report Details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(Enum(ReportType), default=ReportType.CUSTOM)
    
    # Parameters used to generate the report
    parameters = Column(JSONB, default={})
    
    # Output
    format = Column(Enum(ReportFormat), default=ReportFormat.PDF)
    file_url = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)  # in bytes
    
    # Status
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    error_message = Column(Text, nullable=True)
    
    # Generation info
    generated_by = Column(UUID(as_uuid=True), nullable=True)
    generated_at = Column(DateTime, nullable=True)
    
    # Data snapshot (cached report data for quick viewing)
    data = Column(JSONB, default={})
    row_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<Report {self.name}>"
