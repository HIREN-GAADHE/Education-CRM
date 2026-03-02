"""
Student Health Records Models
"""
import enum
from sqlalchemy import Column, String, Date, Boolean, Text, Integer, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import TenantBaseModel, SoftDeleteMixin


class VaccinationStatus(str, enum.Enum):
    COMPLETED = "completed"
    PENDING = "pending"
    SCHEDULED = "scheduled"
    EXEMPTED = "exempted"


class StudentHealthRecord(TenantBaseModel, SoftDeleteMixin):
    """Master health record for a student — one per student."""
    __tablename__ = "student_health_records"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False, unique=True, index=True)

    # Medical basics (extends blood_group already on Student)
    blood_group = Column(String(10), nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    vision_left = Column(String(20), nullable=True)
    vision_right = Column(String(20), nullable=True)

    # Conditions & allergies (free text / comma-separated)
    allergies = Column(Text, nullable=True)        # e.g. "Peanuts, Penicillin"
    chronic_conditions = Column(Text, nullable=True)  # e.g. "Asthma, Diabetes"
    current_medications = Column(Text, nullable=True)
    dietary_restrictions = Column(Text, nullable=True)
    special_needs = Column(Text, nullable=True)

    # Emergency contact (school-side copy, supplements student.emergency_contact)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)

    # Doctor details
    family_doctor_name = Column(String(200), nullable=True)
    family_doctor_phone = Column(String(20), nullable=True)
    health_insurance_number = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)

    student = relationship("Student", foreign_keys=[student_id], lazy="joined")
    visits = relationship("NurseVisit", back_populates="health_record",
                          lazy="dynamic", order_by="NurseVisit.visit_date.desc()")
    vaccinations = relationship("Vaccination", back_populates="health_record",
                                lazy="dynamic", order_by="Vaccination.administered_date.desc()")


class NurseVisit(TenantBaseModel, SoftDeleteMixin):
    """Log of each nurse/clinic visit by a student."""
    __tablename__ = "nurse_visits"

    health_record_id = Column(UUID(as_uuid=True),
                               ForeignKey("student_health_records.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                         nullable=True)

    visit_date = Column(DateTime, nullable=False)
    symptoms = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=True)
    treatment_given = Column(Text, nullable=True)
    medication_given = Column(Text, nullable=True)
    sent_home = Column(Boolean, default=False, nullable=False)
    parent_notified = Column(Boolean, default=False, nullable=False)
    follow_up_required = Column(Boolean, default=False, nullable=False)
    follow_up_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    health_record = relationship("StudentHealthRecord", back_populates="visits")
    student = relationship("Student", foreign_keys=[student_id], lazy="joined")


class Vaccination(TenantBaseModel, SoftDeleteMixin):
    """Vaccination history for a student."""
    __tablename__ = "vaccinations"

    health_record_id = Column(UUID(as_uuid=True),
                               ForeignKey("student_health_records.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    vaccine_name = Column(String(200), nullable=False)
    dose_number = Column(Integer, default=1)
    administered_date = Column(Date, nullable=True)
    administered_by = Column(String(200), nullable=True)
    next_due_date = Column(Date, nullable=True)
    status = Column(String(20), default=VaccinationStatus.COMPLETED, nullable=False)
    batch_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    health_record = relationship("StudentHealthRecord", back_populates="vaccinations")
    student = relationship("Student", foreign_keys=[student_id], lazy="joined")
