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
        Includes class and fee assignment fields.
        """
        headers = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "date_of_birth",
            "gender",
            "admission_number",
            "roll_number",
            "class_name",
            "section",
            "guardian_name",
            "guardian_phone",
            "guardian_email",
            "address_line1",
            "city",
            "state",
            "postal_code",
            # Fee-related fields (optional)
            "fee_type",        # tuition, admission, examination, library, sports, transport, hostel, other
            "fee_amount",      # Total fee amount to assign
            "academic_year",   # e.g., 2024-25
            "fee_due_date",    # YYYY-MM-DD format
        ]
        
        # Sample data row
        sample = [
            "John",
            "Doe",
            "john.doe@example.com",
            "+919876543210",
            "2010-05-15",
            "male",
            "ADM-2024-001",
            "101",
            "10",              # Class name (will auto-link to SchoolClass)
            "A",              # Section (will auto-link to SchoolClass)
            "Jane Doe",
            "+919876543211",
            "jane.doe@example.com",
            "123 Main Street",
            "Mumbai",
            "Maharashtra",
            "400001",
            "tuition",        # Fee type
            "50000",          # Fee amount
            "2024-25",        # Academic year
            "2024-06-30",     # Due date
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
            classes = class_result.scalars().all()
            # Create lookup map: "class_name|section" -> class_id

            
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
            next(io_obj) # Skip original header
            reader = csv.DictReader(io_obj, fieldnames=normalized_headers)
            rows = list(reader)
            results["total_rows"] = len(rows)
            
            for row_num, row in enumerate(rows, start=2):  # Start at 2 (row 1 is headers)
                try:
                    # Validate required fields
                    if not row.get("first_name"):
                        results["errors"].append({
                            "row": row_num,
                            "error": "first_name is required"
                        })
                        continue
                    
                    # Look up class_id
                    class_id, class_error = self._resolve_class_id(classes, row)
                    if class_error:
                        results["errors"].append({
                            "row": row_num,
                            "error": class_error
                        })
                        # If class not found, we continue but don't link?
                        # Or do we SKIP import? 
                        # The user wants valid data. If they specified a class that doesn't exist, it's an error.
                        continue
                    
                    # Check for duplicates by admission_number or email
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
                            ).order_by(Student.is_deleted.asc(), Student.updated_at.desc())
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
                            results["imported_ids"].append(existing.id)
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
                            results["imported_ids"].append(existing.id)
                        elif skip_duplicates:
                            results["skipped"] += 1
                        else:
                            results["errors"].append({
                                "row": row_num,
                                "error": f"Duplicate student: {row.get('admission_number') or row.get('email')}"
                            })
                        continue
                    
                    # Create new student with class_id
                    student = self._create_student_from_row(tenant_id, row, class_id)
                    self.db.add(student)
                    await self.db.flush()  # Get student.id before creating fee
                    
                    # Create fee payment if fee details provided
                    fee_created = await self._create_fee_for_student(tenant_id, student, row, row_num, results)
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
            logger.error(f"Failed to import students: {str(e)}")
            results["errors"].append({"row": 0, "error": f"File parsing error: {str(e)}"})
        
        return results
    
    def _resolve_class_id(self, classes: List[SchoolClass], row: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
        """
        Resolve class_id from row data.
        Handles checking 'class_name'/'class' and 'section'.
        If section is missing, tries to find unique class with that name.
        """
        # Get normalized values
        class_name = str(row.get("class_name", "")).strip() or str(row.get("class", "")).strip()
        # Normalizing class_name in row for consistency
        row["class_name"] = class_name
        
        if not class_name:
            return None, None
            
        section = str(row.get("section", "")).strip()
        
        # Case 1: Name and Section provided
        if section:
            for cls in classes:
                if cls.name.strip().lower() == class_name.lower() and cls.section.strip().lower() == section.lower():
                    return cls.id, None
            
            # List available classes for debugging
            available = [f"'{c.name}'-'{c.section}'" for c in classes]
            return None, f"Class '{class_name}' with Section '{section}' not found. Available: {available[:5]}..."
            
        # Case 2: Only Name provided -> Attempt automatic resolution
        candidates = [c for c in classes if c.name.strip().lower() == class_name.lower()]
        if len(candidates) == 1:
            return candidates[0].id, None
        elif len(candidates) > 1:
            sections = ", ".join([c.section for c in candidates])
            return None, f"Ambiguous class '{class_name}'. Multiple sections found ({sections}). Please specify 'Section' column."
        else:
            return None, f"Class '{class_name}' not found."

    def _create_student_from_row(self, tenant_id: str, row: Dict[str, str], class_id: Optional[Any] = None) -> Student:
        """Create a Student object from a CSV row with optional class linking."""
        # Parse date of birth
        dob = None
        if row.get("date_of_birth"):
            try:
                dob = datetime.strptime(row["date_of_birth"], "%Y-%m-%d")
            except ValueError:
                try:
                    dob = datetime.strptime(row["date_of_birth"], "%d/%m/%Y")
                except ValueError:
                    pass
        
        # Map gender
        gender = None
        if row.get("gender"):
            gender_map = {
                "male": "male",
                "m": "male",
                "female": "female",
                "f": "female",
                "other": "other",
                "o": "other",
            }
            gender = gender_map.get(row["gender"].lower())
        
        return Student(
            tenant_id=tenant_id,
            first_name=row["first_name"].strip(),
            last_name=row.get("last_name", "").strip() or None,
            email=row.get("email", "").strip() or None,
            phone=row.get("phone", "").strip() or None,
            date_of_birth=dob,
            gender=gender,
            admission_number=row.get("admission_number", "").strip() or None,
            roll_number=row.get("roll_number", "").strip() or None,
            class_name=row.get("class_name", "").strip() or None,
            section=row.get("section", "").strip() or None,
            class_id=class_id,  # Link to SchoolClass
            guardian_name=row.get("guardian_name", "").strip() or None,
            guardian_phone=row.get("guardian_phone", "").strip() or None,
            guardian_email=row.get("guardian_email", "").strip() or None,
            address=row.get("address_line1", "").strip() or None,
            city=row.get("city", "").strip() or None,
            state=row.get("state", "").strip() or None,
            postal_code=row.get("postal_code", "").strip() or None,
            status=StudentStatus.ACTIVE,
        )
    
    async def _update_student_from_row(self, student: Student, row: Dict[str, str], class_id: Optional[Any] = None):
        """Update a Student object from a CSV row."""
        # Only update non-empty fields
        if row.get("first_name"):
            student.first_name = row["first_name"].strip()
        if row.get("last_name"):
            student.last_name = row["last_name"].strip()
        if row.get("email"):
            student.email = row["email"].strip()
        if row.get("phone"):
            student.phone = row["phone"].strip()
        if row.get("class_name"):
            student.class_name = row["class_name"].strip()
        if row.get("section"):
            student.section = row["section"].strip()
        if class_id:
            student.class_id = class_id
        if row.get("guardian_name"):
            student.guardian_name = row["guardian_name"].strip()
    
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
            
            # Get academic year
            academic_year = row.get("academic_year", "").strip() or None
            
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
        """
        query = select(Student).where(Student.tenant_id == tenant_id)
        
        if status:
            query = query.where(Student.status == status)
        
        query = query.order_by(Student.created_at.desc())
        
        result = await self.db.execute(query)
        students = result.scalars().all()
        
        # Create CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # Headers
        headers = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "date_of_birth",
            "gender",
            "admission_number",
            "roll_number",
            "class_name",
            "section",
            "status",
            "guardian_name",
            "guardian_phone",
            "guardian_email",
            "address",
            "city",
            "state",
            "postal_code",
            "created_at",
        ]
        writer.writerow(headers)
        
        # Data rows
        for student in students:
            row = [
                str(student.id),
                student.first_name,
                student.last_name or "",
                student.email or "",
                student.phone or "",
                student.date_of_birth.strftime("%Y-%m-%d") if student.date_of_birth else "",
                student.gender.value if student.gender else "",
                student.admission_number or "",
                student.roll_number or "",
                student.class_name or "",
                student.section or "",
                student.status.value if student.status else "",
                student.guardian_name or "",
                student.guardian_phone or "",
                student.guardian_email or "",
                student.address or "",
                student.city or "",
                student.state or "",
                student.postal_code or "",
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
        """
        if not self.has_pandas or not self.has_openpyxl:
            raise RuntimeError("pandas and openpyxl are required for Excel export")
        
        import pandas as pd
        
        query = select(Student).where(Student.tenant_id == tenant_id)
        
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
