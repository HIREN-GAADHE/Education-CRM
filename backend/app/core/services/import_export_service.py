"""
Import/Export service for bulk data operations.
"""
import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date
from io import BytesIO, StringIO
import csv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.student import Student, StudentStatus
from app.models.staff import Staff
from app.models.fee import FeePayment, FeeType, PaymentStatus
from app.models.attendance import Attendance
from app.models.academic import SchoolClass
from app.models.staff import Staff, StaffStatus, StaffType, Gender
from app.models.timetable import TimetableEntry, TimeSlot, Room, DayOfWeek, TimetableStatus, TimetableConflict

logger = logging.getLogger(__name__)


class ImportExportService:
    """
    Service for importing and exporting data in CSV/Excel formats.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.has_pandas = False
        self.has_openpyxl = False
        
        try:
            import pandas as pd
            self.has_pandas = True
        except ImportError:
            logger.warning("pandas not installed. Excel support will be limited.")
        
        try:
            import openpyxl
            self.has_openpyxl = True
        except ImportError:
            logger.warning("openpyxl not installed. Excel export will be disabled.")
    
    # ============== Student Import ==============
    
    def get_student_import_template(self) -> bytes:
        """
        Generate a CSV template for student import.
        Includes all student fields, class linking, and fee assignment.
        """
        headers = [
            # Required fields
            "first_name",
            "last_name",
            "admission_number",
            
            # Personal details
            "middle_name",
            "date_of_birth",
            "gender",
            "blood_group",
            "nationality",
            "religion",
            "caste",
            "category",
            
            # Contact
            "email",
            "phone",
            "alternate_phone",
            
            # Address
            "address_line1",
            "address_line2",
            "city",
            "state",
            "pincode",
            "country",
            
            # Parent/Guardian details
            "father_name",
            "father_phone",
            "father_occupation",
            "mother_name",
            "mother_phone",
            "mother_occupation",
            "guardian_name",
            "guardian_phone",
            "guardian_relation",
            "parent_email",
            
            # Academic
            "roll_number",
            "class_name",
            "section",
            "course",
            "department",
            "batch",
            "semester",
            "year",
            "admission_date",
            "admission_type",
            
            # Fee-related fields (optional)
            "fee_type",
            "fee_amount",
            "academic_year",
            "fee_due_date",
        ]
        
        # Sample data row
        sample = [
            # Required
            "John",
            "Doe",
            "ADM-2024-001",
            
            # Personal
            "William",
            "2010-05-15",
            "male",
            "O+",
            "Indian",
            "",
            "",
            "General",
            
            # Contact
            "john.doe@example.com",
            "+919876543210",
            "",
            
            # Address
            "123 Main Street",
            "Apt 4B",
            "Mumbai",
            "Maharashtra",
            "400001",
            "India",
            
            # Parent/Guardian
            "Robert Doe",
            "+919876543211",
            "Engineer",
            "Mary Doe",
            "+919876543212",
            "Doctor",
            "James Doe",
            "+919876543213",
            "Uncle",
            "parent@example.com",
            
            # Academic
            "101",
            "10",
            "A",
            "Science",
            "Physics",
            "2024-2028",
            "1",
            "1",
            "2024-04-01",
            "Regular",
            
            # Fee
            "tuition",
            "50000",
            "2024-25",
            "2024-06-30",
        ]
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample)
        
        return output.getvalue().encode('utf-8')
    
    async def import_students_from_csv(
        self,
        tenant_id: str,
        file_content: bytes,
        skip_duplicates: bool = True,
        update_existing: bool = False,
    ) -> Dict[str, Any]:
        """
        Import students from CSV file with class linking and fee assignment.
        Uses transaction rollback on failure to ensure data consistency.
        
        Returns:
            Dict with import results including success count, error count, and details
        """
        results = {
            "total_rows": 0,
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "fees_created": 0,
            "errors": [],
            "imported_ids": [],
        }
        
        try:
            # Pre-load all classes for this tenant for efficient lookup
            class_result = await self.db.execute(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant_id,
                    SchoolClass.is_deleted == False
                )
            )
            classes = list(class_result.scalars().all())
            
            # Decode and parse CSV
            content = file_content.decode('utf-8')
            
            # Read first line to get headers and normalize them
            io_obj = StringIO(content)
            csv_reader = csv.reader(io_obj)
            try:
                headers = next(csv_reader)
                normalized_headers = [h.strip().lower().replace(' ', '_') for h in headers]
            except StopIteration:
                results["errors"].append({"row": 1, "error": "File is empty"})
                return results

            # Use DictReader with normalized fieldnames
            io_obj.seek(0)
            next(io_obj)  # Skip original header
            reader = csv.DictReader(io_obj, fieldnames=normalized_headers)
            rows = list(reader)
            results["total_rows"] = len(rows)
            
            # Track if we have critical errors that should trigger rollback
            critical_error_count = 0
            max_critical_errors = 5  # Rollback if more than 5 critical errors
            
            for row_num, row in enumerate(rows, start=2):  # Start at 2 (row 1 is headers)
                try:
                    # Validate required fields
                    if not row.get("first_name"):
                        results["errors"].append({
                            "row": row_num,
                            "error": "first_name is required"
                        })
                        critical_error_count += 1
                        continue
                    
                    if not row.get("last_name"):
                        results["errors"].append({
                            "row": row_num,
                            "error": "last_name is required"
                        })
                        critical_error_count += 1
                        continue
                    
                    # Look up class_id (optional - don't fail if not found)
                    class_id = None
                    if row.get("class_name"):
                        class_id, class_error = self._resolve_class_id(classes, row)
                        if class_error:
                            results["errors"].append({
                                "row": row_num,
                                "error": class_error + " (student will be created without class link)"
                            })
                            # Don't skip - just create without class link
                    
                    # Check for duplicates by admission_number or email (excluding deleted)
                    existing = None
                    if row.get("admission_number"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.admission_number == row["admission_number"],
                            ).order_by(Student.is_deleted.asc(), Student.updated_at.desc())
                        )
                        existing = existing_result.scalars().first()
                    
                    if not existing and row.get("email"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.email == row["email"],
                                Student.is_deleted == False,  # Only check non-deleted
                            )
                        )
                        existing = existing_result.scalars().first()
                    
                    if existing:
                        # Handle soft-deleted students - Reactivate and Update
                        if existing.is_deleted:
                            existing.is_deleted = False
                            existing.status = StudentStatus.ACTIVE
                            await self._update_student_from_row(existing, row, class_id)
                            # Create fees
                            fee_created = await self._create_fee_for_student(tenant_id, existing, row, row_num, results)
                            if fee_created:
                                results["fees_created"] += 1
                            results["imported"] += 1
                            results["imported_ids"].append(str(existing.id))
                            continue
                            
                        # Handle active existing students
                        if update_existing:
                            # Update existing student (including class_id)
                            await self._update_student_from_row(existing, row, class_id)
                            # Create fee payment if provided (even for existing students)
                            fee_created = await self._create_fee_for_student(tenant_id, existing, row, row_num, results)
                            if fee_created:
                                results["fees_created"] += 1
                            results["updated"] += 1
                            results["imported_ids"].append(str(existing.id))
                        elif skip_duplicates:
                            results["skipped"] += 1
                        else:
                            results["errors"].append({
                                "row": row_num,
                                "error": f"Duplicate student: {row.get('admission_number') or row.get('email')}"
                            })
                        continue
                    
                    # Generate admission number if not provided
                    if not row.get("admission_number"):
                        row["admission_number"] = f"ADM-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                    
                    # Create new student with class_id
                    student = self._create_student_from_row(tenant_id, row, class_id)
                    self.db.add(student)
                    await self.db.flush()  # Get student.id before creating fee
                    
                    # Create fee payment if fee details provided
                    fee_created = await self._create_fee_for_student(tenant_id, student, row, row_num, results)
                    if fee_created:
                        results["fees_created"] += 1
                    
                    results["imported"] += 1
                    results["imported_ids"].append(str(student.id))
                    
                except Exception as e:
                    results["errors"].append({
                        "row": row_num,
                        "error": str(e)
                    })
                    critical_error_count += 1
            
            # Check if too many errors - rollback
            if critical_error_count > max_critical_errors and results["imported"] == 0:
                await self.db.rollback()
                results["errors"].insert(0, {
                    "row": 0,
                    "error": f"Import aborted: Too many errors ({critical_error_count}). No data was saved."
                })
                results["imported"] = 0
                results["updated"] = 0
                results["fees_created"] = 0
                results["imported_ids"] = []
                return results
            
            await self.db.commit()
            
        except Exception as e:
            # Rollback on any unhandled exception
            await self.db.rollback()
            logger.error(f"Failed to import students: {str(e)}")
            results["errors"].append({"row": 0, "error": f"Import failed and rolled back: {str(e)}"})
            # Reset counts since we rolled back
            results["imported"] = 0
            results["updated"] = 0
            results["fees_created"] = 0
            results["imported_ids"] = []
        
        return results
    
    def _resolve_class_id(self, classes: List[SchoolClass], row: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
        """
        Resolve class_id from row data.
        Handles checking 'class_name'/'class' and 'section'.
        If section is missing, tries to find unique class with that name.
        Also handles composite names like "10-A" or "10 A".
        """
        # Get normalized values
        class_name = str(row.get("class_name", "")).strip() or str(row.get("class", "")).strip()
        # Normalizing class_name in row for consistency
        row["class_name"] = class_name
        
        if not class_name:
            return None, None
            
        section = str(row.get("section", "")).strip()
        
        # Helper to match class
        def find_match(name: str, sect: str) -> Optional[Any]:
            for cls in classes:
                if cls.name.strip().lower() == name.lower() and cls.section.strip().lower() == sect.lower():
                    return cls.id
            return None

        # Case 1: Name and Section provided explicitly
        if section:
            class_id = find_match(class_name, section)
            if class_id:
                return class_id, None
            
            # List available classes for debugging
            available = [f"'{c.name}'-'{c.section}'" for c in classes]
            return None, f"Class '{class_name}' with Section '{section}' not found. Available: {available[:5]}..."
            
        # Case 2: Only Name provided
        # 2a. Try exact match on Name (assuming unique name or relying on auto-resolution)
        candidates = [c for c in classes if c.name.strip().lower() == class_name.lower()]
        if len(candidates) == 1:
            return candidates[0].id, None
        elif len(candidates) > 1:
            sections = ", ".join([c.section for c in candidates])
            return None, f"Ambiguous class '{class_name}'. Multiple sections found ({sections}). Please specify 'Section' column."
        
        # 2b. Try parsing "Name-Section" or "Name Section"
        # Common delimiters: '-', ' '
        import re
        # Try "10-A"
        if '-' in class_name:
            parts = class_name.split('-', 1)
            name_part = parts[0].strip()
            sect_part = parts[1].strip()
            cid = find_match(name_part, sect_part)
            if cid:
                return cid, None
        
        # Try "10 A" (last token is section? or specific pattern?)
        # Let's try splitting by space if it looks like "Number Letter" or "Word Letter"
        parts = class_name.split()
        if len(parts) >= 2:
            # Assume last part is section
            sect_part = parts[-1]
            name_part = " ".join(parts[:-1])
            cid = find_match(name_part, sect_part)
            if cid:
                return cid, None
                
        return None, f"Class '{class_name}' not found. Try specifying 'Section' explicitly."

    def _create_student_from_row(self, tenant_id: str, row: Dict[str, str], class_id: Optional[Any] = None) -> Student:
        """Create a Student object from a CSV row with all available fields."""
        
        def parse_date(date_str: str) -> Optional[date]:
            """Parse date from various formats."""
            if not date_str:
                return None
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
                try:
                    return datetime.strptime(date_str.strip(), fmt).date()
                except ValueError:
                    continue
            return None
        
        def get_str(key: str) -> Optional[str]:
            """Get stripped string value or None."""
            val = row.get(key, "")
            return val.strip() if val and val.strip() else None
        
        def get_int(key: str) -> Optional[int]:
            """Get integer value or None."""
            val = get_str(key)
            if val:
                try:
                    return int(float(val))
                except ValueError:
                    return None
            return None
        
        # Map gender
        gender = None
        if row.get("gender"):
            gender_map = {
                "male": "male", "m": "male",
                "female": "female", "f": "female",
                "other": "other", "o": "other",
            }
            gender = gender_map.get(row["gender"].lower().strip())
        
        return Student(
            tenant_id=tenant_id,
            # Required fields
            first_name=row["first_name"].strip(),
            last_name=row.get("last_name", "").strip() or "",
            admission_number=get_str("admission_number"),
            
            # Personal details
            middle_name=get_str("middle_name"),
            date_of_birth=parse_date(row.get("date_of_birth", "")),
            gender=gender,
            blood_group=get_str("blood_group"),
            nationality=get_str("nationality") or "Indian",
            religion=get_str("religion"),
            caste=get_str("caste"),
            category=get_str("category"),
            
            # Contact
            email=get_str("email"),
            phone=get_str("phone"),
            alternate_phone=get_str("alternate_phone"),
            
            # Address
            address_line1=get_str("address_line1"),
            address_line2=get_str("address_line2"),
            city=get_str("city"),
            state=get_str("state"),
            pincode=get_str("pincode") or get_str("postal_code"),  # Handle both
            country=get_str("country") or "India",
            
            # Parent/Guardian details
            father_name=get_str("father_name"),
            father_phone=get_str("father_phone"),
            father_occupation=get_str("father_occupation"),
            mother_name=get_str("mother_name"),
            mother_phone=get_str("mother_phone"),
            mother_occupation=get_str("mother_occupation"),
            guardian_name=get_str("guardian_name"),
            guardian_phone=get_str("guardian_phone"),
            guardian_relation=get_str("guardian_relation"),
            parent_email=get_str("parent_email") or get_str("guardian_email"),
            
            # Academic
            roll_number=get_str("roll_number"),
            class_id=class_id,
            course=get_str("course"),
            department=get_str("department"),
            batch=get_str("batch"),
            section=get_str("section"),
            semester=get_int("semester"),
            year=get_int("year"),
            admission_date=parse_date(row.get("admission_date", "")),
            admission_type=get_str("admission_type"),
            
            status=StudentStatus.ACTIVE,
        )
    
    async def _update_student_from_row(self, student: Student, row: Dict[str, str], class_id: Optional[Any] = None):
        """Update a Student object from a CSV row with all available fields."""
        
        def parse_date(date_str: str) -> Optional[date]:
            """Parse date from various formats."""
            if not date_str:
                return None
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
                try:
                    return datetime.strptime(date_str.strip(), fmt).date()
                except ValueError:
                    continue
            return None
        
        def get_str(key: str) -> Optional[str]:
            """Get stripped string value or None."""
            val = row.get(key, "")
            return val.strip() if val and val.strip() else None
        
        def get_int(key: str) -> Optional[int]:
            """Get integer value or None."""
            val = get_str(key)
            if val:
                try:
                    return int(float(val))
                except ValueError:
                    return None
            return None
        
        # Map gender
        gender = None
        if row.get("gender"):
            gender_map = {
                "male": "male", "m": "male",
                "female": "female", "f": "female",
                "other": "other", "o": "other",
            }
            gender = gender_map.get(row["gender"].lower().strip())
        
        # Update all non-empty fields
        # Required
        if get_str("first_name"):
            student.first_name = get_str("first_name")
        if get_str("last_name"):
            student.last_name = get_str("last_name")
        if get_str("admission_number"):
            student.admission_number = get_str("admission_number")
        
        # Personal
        if get_str("middle_name"):
            student.middle_name = get_str("middle_name")
        if row.get("date_of_birth"):
            dob = parse_date(row["date_of_birth"])
            if dob:
                student.date_of_birth = dob
        if gender:
            student.gender = gender
        if get_str("blood_group"):
            student.blood_group = get_str("blood_group")
        if get_str("nationality"):
            student.nationality = get_str("nationality")
        if get_str("religion"):
            student.religion = get_str("religion")
        if get_str("caste"):
            student.caste = get_str("caste")
        if get_str("category"):
            student.category = get_str("category")
        
        # Contact
        if get_str("email"):
            student.email = get_str("email")
        if get_str("phone"):
            student.phone = get_str("phone")
        if get_str("alternate_phone"):
            student.alternate_phone = get_str("alternate_phone")
        
        # Address
        if get_str("address_line1"):
            student.address_line1 = get_str("address_line1")
        if get_str("address_line2"):
            student.address_line2 = get_str("address_line2")
        if get_str("city"):
            student.city = get_str("city")
        if get_str("state"):
            student.state = get_str("state")
        if get_str("pincode") or get_str("postal_code"):
            student.pincode = get_str("pincode") or get_str("postal_code")
        if get_str("country"):
            student.country = get_str("country")
        
        # Parent/Guardian
        if get_str("father_name"):
            student.father_name = get_str("father_name")
        if get_str("father_phone"):
            student.father_phone = get_str("father_phone")
        if get_str("father_occupation"):
            student.father_occupation = get_str("father_occupation")
        if get_str("mother_name"):
            student.mother_name = get_str("mother_name")
        if get_str("mother_phone"):
            student.mother_phone = get_str("mother_phone")
        if get_str("mother_occupation"):
            student.mother_occupation = get_str("mother_occupation")
        if get_str("guardian_name"):
            student.guardian_name = get_str("guardian_name")
        if get_str("guardian_phone"):
            student.guardian_phone = get_str("guardian_phone")
        if get_str("guardian_relation"):
            student.guardian_relation = get_str("guardian_relation")
        if get_str("parent_email") or get_str("guardian_email"):
            student.parent_email = get_str("parent_email") or get_str("guardian_email")
        
        # Academic
        if get_str("roll_number"):
            student.roll_number = get_str("roll_number")
        if class_id:
            student.class_id = class_id
        if get_str("section"):
            student.section = get_str("section")
        if get_str("course"):
            student.course = get_str("course")
        if get_str("department"):
            student.department = get_str("department")
        if get_str("batch"):
            student.batch = get_str("batch")
        if get_int("semester"):
            student.semester = get_int("semester")
        if get_int("year"):
            student.year = get_int("year")
        if row.get("admission_date"):
            adm_date = parse_date(row["admission_date"])
            if adm_date:
                student.admission_date = adm_date
        if get_str("admission_type"):
            student.admission_type = get_str("admission_type")
    
    async def _create_fee_for_student(
        self, 
        tenant_id: str, 
        student: Student, 
        row: Dict[str, str], 
        row_num: int,
        results: Dict[str, Any]
    ) -> bool:
        """Create a FeePayment record for a student if fee details are provided."""
        fee_type_str = row.get("fee_type", "").strip().lower()
        fee_amount_str = row.get("fee_amount", "").strip()
        
        # Skip if no fee details provided
        if not fee_type_str or not fee_amount_str:
            return False
        
        try:
            # Map fee type string to enum
            fee_type_map = {
                "tuition": FeeType.TUITION,
                "admission": FeeType.ADMISSION,
                "examination": FeeType.EXAMINATION,
                "library": FeeType.LIBRARY,
                "laboratory": FeeType.LABORATORY,
                "sports": FeeType.SPORTS,
                "transport": FeeType.TRANSPORT,
                "hostel": FeeType.HOSTEL,
                "mess": FeeType.MESS,
                "other": FeeType.OTHER,
            }
            
            fee_type = fee_type_map.get(fee_type_str)
            if not fee_type:
                results["errors"].append({
                    "row": row_num,
                    "error": f"Invalid fee_type '{fee_type_str}'. Valid: tuition, admission, examination, library, sports, transport, hostel, other"
                })
                return False
            
            # Parse fee amount
            try:
                fee_amount = float(fee_amount_str)
            except ValueError:
                results["errors"].append({
                    "row": row_num,
                    "error": f"Invalid fee_amount '{fee_amount_str}'. Must be a number."
                })
                return False
            
            # Parse due date
            due_date = None
            if row.get("fee_due_date"):
                try:
                    due_date = datetime.strptime(row["fee_due_date"], "%Y-%m-%d").date()
                except ValueError:
                    due_date = date.today()
            
            # Get academic year (default to current-upcoming if missing, e.g. 2025-26)
            academic_year = row.get("academic_year", "").strip()
            if not academic_year:
                 today = date.today()
                 # If before April, we are in previous-current year sequence (e.g. Feb 2026 is 2025-26)
                 # If April or later, we are in current-next year (e.g. April 2026 is 2026-27)
                 start_year = today.year if today.month >= 4 else today.year - 1
                 end_year_short = str(start_year + 1)[-2:]
                 academic_year = f"{start_year}-{end_year_short}"
            
            # Check for existing fee to avoid duplicates
            existing_fee_result = await self.db.execute(
                select(FeePayment).where(
                    FeePayment.student_id == student.id,
                    FeePayment.fee_type == fee_type,
                    FeePayment.academic_year == academic_year,
                    FeePayment.tenant_id == tenant_id,
                )
            )
            existing_fee = existing_fee_result.scalars().first()
            
            if existing_fee:
                # If already paid, do not update amount/date and do not duplicate
                if existing_fee.status == PaymentStatus.PAID:
                    return False
                    
                # Update existing pending/partial fee
                existing_fee.total_amount = fee_amount
                # Only update due date if provided in file
                if due_date:
                    existing_fee.due_date = due_date
                
                # Only update description if it looks generic
                if "Imported fee" in existing_fee.description:
                    existing_fee.description = f"Imported fee - {fee_type.value}"
                    
                return False # Existing fee updated, not created
            
            # Generate transaction ID
            transaction_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"
            
            # Create fee payment record
            fee_payment = FeePayment(
                tenant_id=tenant_id,
                transaction_id=transaction_id,
                student_id=student.id,
                fee_type=fee_type,
                description=f"Imported fee - {fee_type.value}",
                academic_year=academic_year,
                total_amount=fee_amount,
                paid_amount=0.0,
                due_date=due_date,
                status=PaymentStatus.PENDING,
            )
            self.db.add(fee_payment)
            return True
            
        except Exception as e:
            results["errors"].append({
                "row": row_num,
                "error": f"Fee creation failed: {str(e)}"
            })
            return False
    
    # ============== Student Export ==============
    
    async def export_students_to_csv(
        self,
        tenant_id: str,
        status: Optional[StudentStatus] = None,
    ) -> bytes:
        """
        Export students to CSV format.
        Excludes soft-deleted students.
        """
        query = select(Student).where(
            Student.tenant_id == tenant_id,
            Student.is_deleted == False,  # Exclude deleted students
        )
        
        if status:
            query = query.where(Student.status == status)
        
        query = query.order_by(Student.created_at.desc())
        
        result = await self.db.execute(query)
        students = result.scalars().all()
        
        # Create CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # Headers matching the import template
        headers = [
            "id",
            "admission_number",
            "first_name",
            "middle_name",
            "last_name",
            "date_of_birth",
            "gender",
            "blood_group",
            "nationality",
            "religion",
            "caste",
            "category",
            "email",
            "phone",
            "alternate_phone",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "pincode",
            "country",
            "father_name",
            "father_phone",
            "father_occupation",
            "mother_name",
            "mother_phone",
            "mother_occupation",
            "guardian_name",
            "guardian_phone",
            "guardian_relation",
            "parent_email",
            "roll_number",
            "class_id",
            "course",
            "department",
            "batch",
            "section",
            "semester",
            "year",
            "admission_date",
            "admission_type",
            "status",
            "created_at",
        ]
        writer.writerow(headers)
        
        # Data rows
        for student in students:
            row = [
                str(student.id),
                student.admission_number or "",
                student.first_name or "",
                student.middle_name or "",
                student.last_name or "",
                student.date_of_birth.strftime("%Y-%m-%d") if student.date_of_birth else "",
                student.gender.value if student.gender else "",
                student.blood_group or "",
                student.nationality or "",
                student.religion or "",
                student.caste or "",
                student.category or "",
                student.email or "",
                student.phone or "",
                student.alternate_phone or "",
                student.address_line1 or "",
                student.address_line2 or "",
                student.city or "",
                student.state or "",
                student.pincode or "",
                student.country or "",
                student.father_name or "",
                student.father_phone or "",
                student.father_occupation or "",
                student.mother_name or "",
                student.mother_phone or "",
                student.mother_occupation or "",
                student.guardian_name or "",
                student.guardian_phone or "",
                student.guardian_relation or "",
                student.parent_email or "",
                student.roll_number or "",
                str(student.class_id) if student.class_id else "",
                student.course or "",
                student.department or "",
                student.batch or "",
                student.section or "",
                str(student.semester) if student.semester else "",
                str(student.year) if student.year else "",
                student.admission_date.strftime("%Y-%m-%d") if student.admission_date else "",
                student.admission_type or "",
                student.status.value if student.status else "",
                student.created_at.strftime("%Y-%m-%d %H:%M:%S") if student.created_at else "",
            ]
            writer.writerow(row)
        
        return output.getvalue().encode('utf-8')
    
    async def export_students_to_excel(
        self,
        tenant_id: str,
        status: Optional[StudentStatus] = None,
    ) -> bytes:
        """
        Export students to Excel format.
        Excludes soft-deleted students.
        """
        if not self.has_pandas or not self.has_openpyxl:
            raise RuntimeError("pandas and openpyxl are required for Excel export")
        
        import pandas as pd
        
        query = select(Student).where(
            Student.tenant_id == tenant_id,
            Student.is_deleted == False,  # Exclude deleted students
        )
        
        if status:
            query = query.where(Student.status == status)
        
        result = await self.db.execute(query)
        students = result.scalars().all()
        
        # Convert to list of dicts
        data = []
        for student in students:
            data.append({
                "ID": str(student.id),
                "First Name": student.first_name,
                "Last Name": student.last_name or "",
                "Email": student.email or "",
                "Phone": student.phone or "",
                "Date of Birth": student.date_of_birth.strftime("%Y-%m-%d") if student.date_of_birth else "",
                "Gender": student.gender.value if student.gender else "",
                "Admission Number": student.admission_number or "",
                "Roll Number": student.roll_number or "",
                "Class": student.class_name or "",
                "Section": student.section or "",
                "Status": student.status.value if student.status else "",
                "Guardian Name": student.guardian_name or "",
                "Guardian Phone": student.guardian_phone or "",
                "Created At": student.created_at.strftime("%Y-%m-%d") if student.created_at else "",
            })
        
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Students', index=False)
        
        output.seek(0)
        return output.getvalue()
    
    # ============== Import from Excel ==============
    
    async def import_students_from_excel(
        self,
        tenant_id: str,
        file_content: bytes,
        skip_duplicates: bool = True,
        update_existing: bool = False,
    ) -> Dict[str, Any]:
        """
        Import students from Excel file with class linking and fee assignment.
        """
        if not self.has_pandas:
            raise RuntimeError("pandas is required for Excel import")
        
        import pandas as pd
        
        results = {
            "total_rows": 0,
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "fees_created": 0,
            "errors": [],
            "imported_ids": [],
        }
        
        try:
            # Pre-load all classes for this tenant for efficient lookup
            class_result = await self.db.execute(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant_id,
                    SchoolClass.is_deleted == False
                )
            )
            classes = class_result.scalars().all()

            
            # Read Excel file
            df = pd.read_excel(BytesIO(file_content))
            
            # Normalize column names
            df.columns = [str(col).lower().replace(" ", "_") for col in df.columns]
            
            results["total_rows"] = len(df)
            
            for idx, row in df.iterrows():
                row_num = idx + 2  # Excel row number (1-indexed, plus header)
                try:
                    row_dict = row.to_dict()
                    
                    # Convert NaN to empty string
                    for key, value in row_dict.items():
                        if pd.isna(value):
                            row_dict[key] = ""
                        elif isinstance(value, float) and value.is_integer():
                            row_dict[key] = str(int(value))
                        else:
                            row_dict[key] = str(value)
                    
                    # Validate required fields
                    if not row_dict.get("first_name"):
                        results["errors"].append({
                            "row": row_num,
                            "error": "first_name is required"
                        })
                        continue
                    
                    # Look up class_id
                    class_id, class_error = self._resolve_class_id(classes, row_dict)
                    if class_error:
                        results["errors"].append({
                            "row": row_num,
                            "error": class_error
                        })
                        continue
                    
                    # Check for duplicates
                    existing = None
                    if row_dict.get("admission_number"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.admission_number == row_dict["admission_number"],
                            ).order_by(Student.is_deleted.asc(), Student.updated_at.desc())
                        )
                        existing = existing_result.scalars().first()
                    
                    if existing:
                        # Handle soft-deleted students - Reactivate and Update
                        if existing.is_deleted:
                            existing.is_deleted = False
                            existing.status = StudentStatus.ACTIVE
                            await self._update_student_from_row(existing, row_dict, class_id)
                            # Create fees
                            fee_created = await self._create_fee_for_student(tenant_id, existing, row_dict, row_num, results)
                            if fee_created:
                                results["fees_created"] += 1
                            results["imported"] += 1
                            results["imported_ids"].append(existing.id)
                            continue
                            
                        # Handle active existing students
                        if update_existing:
                            await self._update_student_from_row(existing, row_dict, class_id)
                            # Create fee payment if provided (even for existing students)
                            fee_created = await self._create_fee_for_student(tenant_id, existing, row_dict, row_num, results)
                            if fee_created:
                                results["fees_created"] += 1
                            results["updated"] += 1
                            results["imported_ids"].append(existing.id)
                        elif skip_duplicates:
                            results["skipped"] += 1
                        else:
                            results["errors"].append({
                                "row": row_num,
                                "error": f"Duplicate student: {row_dict.get('admission_number')}"
                            })
                        continue
                    
                    # Create new student with class_id
                    student = self._create_student_from_row(tenant_id, row_dict, class_id)
                    self.db.add(student)
                    await self.db.flush()  # Get student.id before creating fee
                    
                    # Create fee payment if fee details provided
                    fee_created = await self._create_fee_for_student(tenant_id, student, row_dict, row_num, results)
                    if fee_created:
                        results["fees_created"] += 1
                    
                    results["imported"] += 1
                    results["imported_ids"].append(student.id)
                    
                except Exception as e:
                    results["errors"].append({
                        "row": row_num,
                        "error": str(e)
                    })
            
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to import students from Excel: {str(e)}")
            results["errors"].append({"row": 0, "error": f"File parsing error: {str(e)}"})
        
        return results

    # ============== Fee Export ==============
    
    async def export_fees_to_csv(self, tenant_id: str) -> bytes:
        """Export fees to CSV."""
        query = select(FeePayment).where(FeePayment.tenant_id == tenant_id).order_by(FeePayment.payment_date.desc())
        result = await self.db.execute(query)
        payments = result.scalars().all()
        
        output = StringIO()
        writer = csv.writer(output)
        
        headers = ["Transaction ID", "Student ID", "Fee Type", "Total Amount", "Paid Amount", "Balance", "Start Date", "Due Date", "Frequency", "Payment Date", "Payment Method", "Status", "Notes"]
        writer.writerow(headers)
        
        for p in payments:
            writer.writerow([
                p.transaction_id,
                str(p.student_id),
                p.fee_type.value if hasattr(p.fee_type, 'value') else str(p.fee_type),
                p.total_amount,
                p.paid_amount,
                p.total_amount - p.paid_amount,
                str(p.start_date) if p.start_date else "",
                str(p.due_date) if p.due_date else "",
                p.frequency.value if hasattr(p.frequency, 'value') else str(p.frequency),
                str(p.payment_date) if p.payment_date else "",
                p.payment_method.value if hasattr(p.payment_method, 'value') else str(p.payment_method),
                p.status.value if hasattr(p.status, 'value') else str(p.status),
                p.notes or ""
            ])
            
        return output.getvalue().encode('utf-8')

    # ============== Attendance Export ==============
    
    async def export_attendance_to_csv(self, tenant_id: str) -> bytes:
        """Export attendance to CSV."""
        query = select(Attendance).where(Attendance.tenant_id == tenant_id).order_by(Attendance.date.desc())
        result = await self.db.execute(query)
        records = result.scalars().all()
        
        output = StringIO()
        writer = csv.writer(output)
        
        headers = ["Date", "Student ID", "Status", "Remarks", "Recorded By"]
        writer.writerow(headers)
        
        for r in records:
            writer.writerow([
                str(r.date),
                str(r.student_id),
                r.status.value if hasattr(r.status, 'value') else str(r.status),
                r.remarks or "",
                str(r.recorded_by) if r.recorded_by else ""
            ])
            
        return output.getvalue().encode('utf-8')

    # ============== Staff Import/Export ==============

    # ============== Staff Import/Export ==============

    def get_staff_import_template(self) -> bytes:
        """Generate CSV template for staff import."""
        headers = [
            "first_name", "last_name", "email", "phone", "employee_id", 
            "staff_type", "designation", "department", "qualification", 
            "joining_date", "gender", "date_of_birth", "address", "city", "state",
            "classes" # Comma separated Class Name-Section (e.g. "10-A, 9-B")
        ]
        sample = [
            "John", "Smith", "john.smith@school.com", "+919876543210", "EMP001",
            "teaching", "Senior Teacher", "Science", "M.Sc. Physics",
            "2023-06-01", "male", "1985-05-15", "123 Teacher Colony", "Mumbai", "Maharashtra",
            "10-A, 9-B"
        ]
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample)
        return output.getvalue().encode('utf-8')

    async def import_staff_from_csv(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        """Import staff from CSV."""
        return await self._import_staff_generic(tenant_id, file_content.decode('utf-8'), is_csv=True)

    async def import_staff_from_excel(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        """Import staff from Excel."""
        if not self.has_pandas:
            raise RuntimeError("pandas is required for Excel import")
        import pandas as pd
        df = pd.read_excel(BytesIO(file_content))
        # Convert to CSV-like structure for generic processing
        return await self._import_staff_generic(tenant_id, df, is_csv=False)

    async def _import_staff_generic(self, tenant_id: str, data: Any, is_csv: bool) -> Dict[str, Any]:
        """Generic staff import logic."""
        results = {"total_rows": 0, "imported": 0, "errors": []}
        
        try:
            # Pre-load classes for resolution
            class_result = await self.db.execute(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant_id, 
                    SchoolClass.is_deleted == False
                )
            )
            all_classes = class_result.scalars().all()

            rows = []
            if is_csv:
                io_obj = StringIO(data)
                reader = csv.DictReader(io_obj)
                # Normalize headers
                if reader.fieldnames:
                    reader.fieldnames = [h.strip().lower().replace(' ', '_') for h in reader.fieldnames]
                rows = list(reader)
            else:
                # Pandas DataFrame
                data.columns = [str(col).strip().lower().replace(" ", "_") for col in data.columns]
                rows = data.to_dict('records')

            results["total_rows"] = len(rows)

            for idx, row in enumerate(rows):
                row_num = idx + 2
                try:
                    # Clean data
                    row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
                    
                    if not row.get("first_name") or not row.get("email"):
                        results["errors"].append({"row": row_num, "error": "first_name and email are required"})
                        continue

                    # Check existence
                    existing = await self.db.execute(select(Staff).where(
                        Staff.tenant_id == tenant_id,
                        (Staff.email == row["email"]) | (Staff.employee_id == row.get("employee_id"))
                    ))
                    existing_staff = existing.scalars().first()
                    
                    if existing_staff:
                         # For now, skip duplicates. Could add update mode later.
                        results["errors"].append({"row": row_num, "error": f"Staff with email {row['email']} or ID {row.get('employee_id')} already exists"})
                        continue

                    # Map Enums
                    staff_type = StaffType.TEACHING
                    if row.get("staff_type"):
                        try:
                            # Try to match enum values (teaching, non_teaching, etc.)
                            val = row["staff_type"].lower().replace(' ', '_')
                            # Check if valid
                            if val in [e.value for e in StaffType]:
                                staff_type = StaffType(val)
                        except ValueError:
                            pass # Default to teaching

                    gender = None
                    if row.get("gender"):
                        try:
                            val = row["gender"].lower()
                            if val in [e.value for e in Gender]:
                                gender = Gender(val)
                        except ValueError:
                            pass

                    # Dates
                    joining_date = None
                    if row.get("joining_date"):
                        try:
                            joining_date = datetime.strptime(row["joining_date"], "%Y-%m-%d").date()
                        except:
                            pass
                            
                    dob = None
                    if row.get("date_of_birth"):
                        try:
                            dob = datetime.strptime(row["date_of_birth"], "%Y-%m-%d").date()
                        except:
                            pass

                    staff = Staff(
                        tenant_id=tenant_id,
                        first_name=row["first_name"],
                        last_name=row.get("last_name"),
                        email=row["email"],
                        phone=row.get("phone"),
                        employee_id=row.get("employee_id") or f"EMP-{uuid.uuid4().hex[:6].upper()}",
                        staff_type=staff_type,
                        designation=row.get("designation"),
                        department=row.get("department"),
                        qualification=row.get("qualification"),
                        joining_date=joining_date,
                        date_of_birth=dob,
                        gender=gender,
                        address=row.get("address"),
                        city=row.get("city"),
                        state=row.get("state"),
                        status=StaffStatus.ACTIVE
                    )
                    
                    # Handle Classes
                    if row.get("classes"):
                        # specific format: "Class 10-A, Class 9-B" or just "10-A, 9-B"
                        # We try to split by comma and match name-section
                        class_strs = [c.strip() for c in row["classes"].split(',') if c.strip()]
                        valid_classes = []
                        for c_str in class_strs:
                            # Try splitting by last hyphen for name-section
                            parts = c_str.rsplit('-', 1)
                            if len(parts) == 2:
                                c_name, c_sec = parts[0].strip(), parts[1].strip()
                                # Find match
                                match = next((c for c in all_classes if c.name.lower() == c_name.lower() and c.section.lower() == c_sec.lower()), None)
                                if match:
                                    valid_classes.append(match)
                        
                        if valid_classes:
                            staff.associated_classes = valid_classes
                            
                    self.db.add(staff)
                    results["imported"] += 1

                except Exception as e:
                    results["errors"].append({"row": row_num, "error": str(e)})

            await self.db.commit()

        except Exception as e:
            logger.error(f"Staff import failed: {e}")
            results["errors"].append({"row": 0, "error": str(e)})

        return results

    async def export_staff_to_csv(self, tenant_id: str) -> bytes:
        # Eager load associated classes
        from sqlalchemy.orm import selectinload
        result = await self.db.execute(
            select(Staff)
            .options(selectinload(Staff.associated_classes))
            .where(Staff.tenant_id == tenant_id)
        )
        staff_list = result.scalars().all()
        
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            "first_name", "last_name", "email", "phone", "employee_id", 
            "staff_type", "designation", "department", "qualification", 
            "joining_date", "gender", "date_of_birth", "address", "city", "state",
            "classes", "status"
        ]
        writer.writerow(headers)
        
        for s in staff_list:
            # Format classes
            classes_str = ""
            if s.associated_classes:
                classes_str = ", ".join([f"{c.name}-{c.section}" for c in s.associated_classes])
                
            writer.writerow([
                s.first_name,
                s.last_name or "",
                s.email or "",
                s.phone or "",
                s.employee_id,
                s.staff_type.value if s.staff_type else "",
                s.designation or "",
                s.department or "",
                s.qualification or "",
                s.joining_date.strftime("%Y-%m-%d") if s.joining_date else "",
                s.gender.value if s.gender else "",
                s.date_of_birth.strftime("%Y-%m-%d") if s.date_of_birth else "",
                s.address or "",
                s.city or "",
                s.state or "",
                classes_str,
                s.status.value
            ])
        return output.getvalue().encode('utf-8')

    # ============== Timetable Import/Export ==============

    def get_timetable_import_template(self) -> bytes:
        headers = [
            "day", "start_time", "end_time", "class", "section", 
            "subject", "teacher_email_or_id", "room", "slot_type"
        ]
        sample = [
            "Monday", "09:00", "10:00", "10", "A", 
            "Mathematics", "john.smith@school.com", "Room 101", "class"
        ]
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample)
        return output.getvalue().encode('utf-8')

    async def import_timetable_from_csv(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        return await self._import_timetable_generic(tenant_id, file_content.decode('utf-8'), is_csv=True)

    async def import_timetable_from_excel(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        if not self.has_pandas:
            raise RuntimeError("pandas required")
        import pandas as pd
        df = pd.read_excel(BytesIO(file_content))
        return await self._import_timetable_generic(tenant_id, df, is_csv=False)

    async def _import_timetable_generic(self, tenant_id: str, data: Any, is_csv: bool) -> Dict[str, Any]:
        results = {"total_rows": 0, "imported": 0, "errors": []}
        
        # Helper: Get DayOfWeek
        day_map = {d.name.lower(): d for d in DayOfWeek}
        
        try:
            # Load required data for lookups
            staff_result = await self.db.execute(select(Staff).where(Staff.tenant_id == tenant_id))
            staff_list = staff_result.scalars().all()
            staff_map = {s.email: s.id for s in staff_list if s.email}
            staff_map.update({s.employee_id: s.id for s in staff_list if s.employee_id}) # Allow lookup by ID too
            
            # Rooms setup (optional lookup if strict validation needed, else create/use string)
            # For now we'll fetch rooms to map if possible, but TimetableEntry uses room_id
            room_result = await self.db.execute(select(Room).where(Room.tenant_id == tenant_id))
            rooms = room_result.scalars().all()
            room_map = {r.name.lower(): r.id for r in rooms}

            rows = []
            if is_csv:
                reader = csv.DictReader(StringIO(data))
                if reader.fieldnames:
                    reader.fieldnames = [h.strip().lower().replace(' ', '_') for h in reader.fieldnames]
                rows = list(reader)
            else:
                data.columns = [str(c).strip().lower().replace(' ', '_') for c in data.columns]
                rows = data.to_dict('records')

            results["total_rows"] = len(rows)

            for idx, row in enumerate(rows):
                row_num = idx + 2
                try:
                    row = {k: str(v).strip() for k, v in row.items() if v is not None}
                    
                    if not row.get("day") or not row.get("start_time"):
                        results["errors"].append({"row": row_num, "error": "Day and Start Time required"})
                        continue

                    # Parse Day
                    day_enum = day_map.get(row["day"].lower())
                    if not day_enum:
                         results["errors"].append({"row": row_num, "error": f"Invalid day: {row['day']}"})
                         continue

                    # Parse/Find TimeSlot - Complex: Using start/end time to find or create slot
                    # Strategy: Try to find existing slot by start/end time. If not, create? 
                    # Simpler strategy: Use TimeSlot if it exists, else we need logic.
                    # For bulk import, let's look up TimeSlot by start/end.
                    try:
                        st = datetime.strptime(row["start_time"], "%H:%M").time()
                        et = datetime.strptime(row["end_time"], "%H:%M").time()
                    except ValueError:
                        results["errors"].append({"row": row_num, "error": "Invalid time format (HH:MM)"})
                        continue

                    slot_q = select(TimeSlot).where(
                        TimeSlot.tenant_id == tenant_id,
                        TimeSlot.start_time == st,
                        TimeSlot.end_time == et
                    )
                    slot = (await self.db.execute(slot_q)).scalars().first()
                    
                    if not slot:
                        # Auto-create slot?
                        slot = TimeSlot(
                            tenant_id=tenant_id,
                            name=f"{row['start_time']}-{row['end_time']}",
                            start_time=st,
                            end_time=et
                        )
                        self.db.add(slot)
                        await self.db.flush()

                    # Teacher
                    teacher_id = None
                    t_identifier = row.get("teacher_email_or_id")
                    if t_identifier:
                        teacher_id = staff_map.get(t_identifier) or staff_map.get(t_identifier.lower()) # check case-insensitive maybe?
                    
                    # Room
                    room_id = None
                    if row.get("room"):
                        room_id = room_map.get(row["room"].lower())

                    entry = TimetableEntry(
                        tenant_id=tenant_id,
                        time_slot_id=slot.id,
                        day_of_week=day_enum,
                        class_name=row.get("class"),
                        section=row.get("section"),
                        subject_name=row.get("subject"),
                        teacher_id=teacher_id,
                        room_id=room_id,
                        status=TimetableStatus.ACTIVE
                    )
                    self.db.add(entry)
                    results["imported"] += 1

                except Exception as e:
                     results["errors"].append({"row": row_num, "error": str(e)})

            await self.db.commit()

        except Exception as e:
            logger.error(f"Timetable import failed: {e}")
            results["errors"].append({"row": 0, "error": str(e)})
            
        return results

    async def export_timetable_to_csv(self, tenant_id: str) -> bytes:
        # Simple flat export
        query = select(TimetableEntry).where(TimetableEntry.tenant_id == tenant_id).order_by(TimetableEntry.day_of_week, TimetableEntry.time_slot_id)
        entries = (await self.db.execute(query)).scalars().all()
        
        output = StringIO()
        writer = csv.writer(output)
        headers = ["Day", "Time Slot", "Class", "Section", "Subject", "Teacher", "Room"]
        writer.writerow(headers)
        
        for e in entries:
            # Need to lazy load or joined load relations for efficient export, doing simplified here
            # Assuming relations might not be loaded, using IDs or safe access if loaded
            # Real prod code should use joinedload in query
            writer.writerow([
                e.day_of_week.name.title(),
                f"{e.time_slot.start_time.strftime('%H:%M')}-{e.time_slot.end_time.strftime('%H:%M')}" if e.time_slot else "",
                e.class_name or "",
                e.section or "",
                e.subject_name or "",
                str(e.teacher_id) if e.teacher_id else "", # ideally resolve name
                str(e.room_id) if e.room_id else ""
            ])
            
        return output.getvalue().encode('utf-8')

    # ============== Classes Import/Export ==============

    def get_classes_import_template(self) -> bytes:
        """Generate CSV template for classes import."""
        headers = ["name", "section", "capacity", "class_teacher_email"]
        sample = ["10", "A", "40", "teacher@example.com"]
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample)
        return output.getvalue().encode('utf-8')

    async def import_classes_from_csv(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        """Import classes from CSV."""
        return await self._import_classes_generic(tenant_id, file_content.decode('utf-8'), is_csv=True)

    async def import_classes_from_excel(self, tenant_id: str, file_content: bytes) -> Dict[str, Any]:
        """Import classes from Excel."""
        if not self.has_pandas:
            raise RuntimeError("pandas is required for Excel import")
        import pandas as pd
        df = pd.read_excel(BytesIO(file_content))
        return await self._import_classes_generic(tenant_id, df, is_csv=False)

    async def _import_classes_generic(self, tenant_id: str, data: Any, is_csv: bool) -> Dict[str, Any]:
        """Generic classes import logic."""
        results = {"total_rows": 0, "imported": 0, "errors": []}
        
        try:
            # Pre-load existing classes
            existing_classes_result = await self.db.execute(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant_id,
                    SchoolClass.is_deleted == False
                )
            )
            existing_classes = {(c.name.lower(), c.section.lower()) for c in existing_classes_result.scalars().all()}
            
            # Pre-load staff for teacher lookup
            staff_result = await self.db.execute(
                select(Staff).where(Staff.tenant_id == tenant_id)
            )
            staff_map = {s.email.lower(): s.id for s in staff_result.scalars().all() if s.email}

            rows = []
            if is_csv:
                io_obj = StringIO(data)
                reader = csv.DictReader(io_obj)
                if reader.fieldnames:
                    reader.fieldnames = [h.strip().lower().replace(' ', '_') for h in reader.fieldnames]
                rows = list(reader)
            else:
                data.columns = [str(col).strip().lower().replace(" ", "_") for col in data.columns]
                rows = data.to_dict('records')
            
            results["total_rows"] = len(rows)
            
            for idx, row in enumerate(rows):
                row_num = idx + 2
                try:
                    row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
                    
                    if not row.get("name") or not row.get("section"):
                        results["errors"].append({"row": row_num, "error": "name and section are required"})
                        continue
                        
                    # Check uniqueness
                    if (row["name"].lower(), row["section"].lower()) in existing_classes:
                        results["errors"].append({"row": row_num, "error": f"Class {row['name']}-{row['section']} already exists"})
                        continue
                    
                    # Teacher Lookup
                    class_teacher_id = None
                    if row.get("class_teacher_email"):
                        class_teacher_id = staff_map.get(row["class_teacher_email"].lower())
                        if not class_teacher_id:
                             # Warning but continue
                             pass

                    # Capacity
                    capacity = 40
                    if row.get("capacity"):
                        try:
                            capacity = int(float(row["capacity"]))
                        except ValueError:
                            results["errors"].append({"row": row_num, "error": "Capacity must be a number"})
                            continue

                    new_class = SchoolClass(
                        tenant_id=tenant_id,
                        name=row["name"],
                        section=row["section"],
                        capacity=capacity,
                        class_teacher_id=class_teacher_id
                    )
                    self.db.add(new_class)
                    # Add to local set to catch duplicates within the file
                    existing_classes.add((row["name"].lower(), row["section"].lower()))
                    results["imported"] += 1
                    
                except Exception as e:
                    results["errors"].append({"row": row_num, "error": str(e)})
                    
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Classes import failed: {e}")
            results["errors"].append({"row": 0, "error": str(e)})
            
        return results

    async def export_classes_to_csv(self, tenant_id: str) -> bytes:
        """Export classes to CSV."""
        from sqlalchemy.orm import selectinload
        # Eager load class teacher
        result = await self.db.execute(
            select(SchoolClass)
            .options(selectinload(SchoolClass.class_teacher))
            .where(SchoolClass.tenant_id == tenant_id, SchoolClass.is_deleted == False)
            .order_by(SchoolClass.name, SchoolClass.section)
        )
        classes = result.scalars().all()
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["name", "section", "capacity", "class_teacher_name", "class_teacher_email", "student_count"])
        
        # We need student counts efficiently. For now, doing separate query or ignoring. 
        # Plan said query all classes.
        # Let's get checks.
        
        # Optimization: Fetch counts in one go
        count_stmt = select(
            Student.class_id,
            func.count(Student.id).label('count')
        ).where(
            Student.tenant_id == tenant_id,
            Student.is_deleted == False
        ).group_by(Student.class_id)
        count_result = await self.db.execute(count_stmt)
        counts = {str(row.class_id): row.count for row in count_result.all()}
        
        for c in classes:
            teacher_name = c.class_teacher.full_name if c.class_teacher else ""
            teacher_email = c.class_teacher.email if c.class_teacher else ""
            count = counts.get(str(c.id), 0)
            
            writer.writerow([
                c.name,
                c.section,
                c.capacity,
                teacher_name,
                teacher_email,
                count
            ])
            
        return output.getvalue().encode('utf-8')
