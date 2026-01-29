"""
Library Management Models
Complete library management with books, members, issues, and fines.
"""
from sqlalchemy import (
    Column, String, Integer, Date, DateTime, Boolean, 
    Float, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class BookCategory(str, enum.Enum):
    """Book category enumeration."""
    FICTION = "fiction"
    NON_FICTION = "non_fiction"
    TEXTBOOK = "textbook"
    REFERENCE = "reference"
    MAGAZINE = "magazine"
    JOURNAL = "journal"
    NEWSPAPER = "newspaper"
    RESEARCH = "research"
    CHILDREN = "children"
    BIOGRAPHY = "biography"
    HISTORY = "history"
    SCIENCE = "science"
    TECHNOLOGY = "technology"
    ARTS = "arts"
    OTHER = "other"


class BookCondition(str, enum.Enum):
    """Physical condition of book copy."""
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    DAMAGED = "damaged"
    LOST = "lost"


class IssueStatus(str, enum.Enum):
    """Book issue status."""
    ISSUED = "issued"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"
    RENEWED = "renewed"


class MemberType(str, enum.Enum):
    """Library member type."""
    STUDENT = "student"
    STAFF = "staff"
    FACULTY = "faculty"
    GUEST = "guest"


class Book(TenantBaseModel, SoftDeleteMixin):
    """
    Book catalog - represents a unique book title.
    Each book can have multiple copies.
    """
    __tablename__ = "library_books"
    
    # Book identification
    isbn = Column(String(20), nullable=True, index=True)
    isbn13 = Column(String(17), nullable=True, index=True)
    accession_number = Column(String(50), nullable=True, index=True)
    
    # Book details
    title = Column(String(500), nullable=False, index=True)
    subtitle = Column(String(500), nullable=True)
    author = Column(String(300), nullable=False, index=True)
    co_authors = Column(JSONB, default=[])  # List of co-authors
    
    # Publication info
    publisher = Column(String(200), nullable=True)
    publication_year = Column(Integer, nullable=True)
    edition = Column(String(50), nullable=True)
    language = Column(String(50), default="English")
    
    # Classification
    category = Column(SQLEnum(BookCategory), default=BookCategory.OTHER)
    subject = Column(String(200), nullable=True)
    keywords = Column(JSONB, default=[])  # Search keywords
    
    # Physical details
    pages = Column(Integer, nullable=True)
    binding = Column(String(50), nullable=True)  # paperback, hardcover
    
    # Library specific
    rack_number = Column(String(50), nullable=True)
    shelf_number = Column(String(50), nullable=True)
    
    # Pricing
    price = Column(Float, nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    
    # Inventory
    total_copies = Column(Integer, default=1)
    available_copies = Column(Integer, default=1)
    
    # Extra data
    extra_data = Column(JSONB, default={})
    
    # Relationships
    copies = relationship("BookCopy", back_populates="book", lazy="dynamic")
    
    # Unique ISBN per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'isbn', name='uq_book_isbn'),
        UniqueConstraint('tenant_id', 'isbn13', name='uq_book_isbn13'),
    )
    
    def __repr__(self):
        return f"<Book {self.title} by {self.author}>"


class BookCopy(TenantBaseModel):
    """
    Individual copies of books in the library.
    Each copy has its own barcode and condition.
    """
    __tablename__ = "library_book_copies"
    
    book_id = Column(UUID(as_uuid=True), ForeignKey("library_books.id", ondelete="CASCADE"), nullable=False)
    
    # Copy identification
    barcode = Column(String(50), nullable=False, index=True)
    copy_number = Column(Integer, default=1)
    
    # Physical status
    condition = Column(SQLEnum(BookCondition), default=BookCondition.GOOD)
    is_available = Column(Boolean, default=True)
    is_reference_only = Column(Boolean, default=False)  # Cannot be issued
    
    # Location
    rack_number = Column(String(50), nullable=True)
    shelf_number = Column(String(50), nullable=True)
    
    # Acquisition
    acquisition_date = Column(Date, nullable=True)
    acquisition_source = Column(String(200), nullable=True)  # purchase, donation
    acquisition_price = Column(Float, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    book = relationship("Book", back_populates="copies")
    issues = relationship("BookIssue", back_populates="book_copy", lazy="dynamic")
    
    # Unique barcode per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'barcode', name='uq_book_copy_barcode'),
    )
    
    def __repr__(self):
        return f"<BookCopy {self.barcode}>"


class LibraryMember(TenantBaseModel):
    """
    Library member - linked to either a student or staff.
    """
    __tablename__ = "library_members"
    
    # Member identification
    member_code = Column(String(50), nullable=False, index=True)
    
    # Link to user/student/staff
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    
    # Member type
    member_type = Column(SQLEnum(MemberType), default=MemberType.STUDENT)
    
    # Membership details
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    
    # Membership period
    membership_start = Column(Date, nullable=True)
    membership_end = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Issue limits
    max_books = Column(Integer, default=3)  # Max books member can borrow
    max_days = Column(Integer, default=14)  # Default issue period in days
    
    # Fines
    total_fines = Column(Float, default=0)
    fines_paid = Column(Float, default=0)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    student = relationship("Student", foreign_keys=[student_id])
    staff = relationship("Staff", foreign_keys=[staff_id])
    issues = relationship("BookIssue", back_populates="member", lazy="dynamic")
    
    # Unique member code per tenant
    __table_args__ = (
        UniqueConstraint('tenant_id', 'member_code', name='uq_library_member_code'),
    )
    
    @property
    def outstanding_fines(self) -> float:
        return self.total_fines - self.fines_paid
    
    def __repr__(self):
        return f"<LibraryMember {self.member_code}: {self.name}>"


class BookIssue(TenantBaseModel):
    """
    Book issue/return transaction.
    """
    __tablename__ = "library_book_issues"
    
    # Links
    book_copy_id = Column(UUID(as_uuid=True), ForeignKey("library_book_copies.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(UUID(as_uuid=True), ForeignKey("library_members.id", ondelete="CASCADE"), nullable=False)
    
    # Issue details
    issue_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=False)
    return_date = Column(Date, nullable=True)
    
    # Status
    status = Column(SQLEnum(IssueStatus), default=IssueStatus.ISSUED)
    
    # Renewal tracking
    renewal_count = Column(Integer, default=0)
    max_renewals = Column(Integer, default=2)
    
    # Fine calculation
    fine_amount = Column(Float, default=0)
    fine_paid = Column(Boolean, default=False)
    fine_per_day = Column(Float, default=5.0)  # Default fine per day
    
    # Staff who processed
    issued_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    returned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Condition check
    condition_at_issue = Column(SQLEnum(BookCondition), nullable=True)
    condition_at_return = Column(SQLEnum(BookCondition), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    book_copy = relationship("BookCopy", back_populates="issues")
    member = relationship("LibraryMember", back_populates="issues")
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    returned_to = relationship("User", foreign_keys=[returned_to_id])
    
    @property
    def is_overdue(self) -> bool:
        if self.status == IssueStatus.RETURNED:
            return False
        return date.today() > self.due_date
    
    @property
    def overdue_days(self) -> int:
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days
    
    def calculate_fine(self) -> float:
        """Calculate fine based on overdue days."""
        if self.overdue_days > 0:
            return self.overdue_days * self.fine_per_day
        return 0
    
    def __repr__(self):
        return f"<BookIssue {self.id} - {self.status.value}>"


class LibrarySetting(TenantBaseModel):
    """
    Library settings per tenant.
    """
    __tablename__ = "library_settings"
    
    # Issue settings
    default_issue_days = Column(Integer, default=14)
    max_renewals = Column(Integer, default=2)
    
    # Fine settings
    fine_per_day = Column(Float, default=5.0)
    fine_on_sunday = Column(Boolean, default=False)
    fine_on_holidays = Column(Boolean, default=False)
    max_fine_per_book = Column(Float, nullable=True)
    
    # Member limits by type
    student_max_books = Column(Integer, default=3)
    staff_max_books = Column(Integer, default=5)
    faculty_max_books = Column(Integer, default=10)
    
    # Notifications
    send_due_reminders = Column(Boolean, default=True)
    reminder_days_before = Column(Integer, default=2)
    send_overdue_alerts = Column(Boolean, default=True)
    
    # Working hours (stored as JSON)
    working_hours = Column(JSONB, default={
        "monday": {"open": "09:00", "close": "17:00"},
        "tuesday": {"open": "09:00", "close": "17:00"},
        "wednesday": {"open": "09:00", "close": "17:00"},
        "thursday": {"open": "09:00", "close": "17:00"},
        "friday": {"open": "09:00", "close": "17:00"},
        "saturday": {"open": "09:00", "close": "13:00"},
        "sunday": None
    })
    
    def __repr__(self):
        return f"<LibrarySetting tenant={self.tenant_id}>"
