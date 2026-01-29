"""
Import/Export service for bulk data operations.
"""
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from io import BytesIO, StringIO
import csv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.student import Student, StudentStatus
from app.models.staff import Staff
from app.models.fee import FeePayment
from app.models.attendance import Attendance

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
            "Class 10",
            "A",
            "Jane Doe",
            "+919876543211",
            "jane.doe@example.com",
            "123 Main Street",
            "Mumbai",
            "Maharashtra",
            "400001",
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
        Import students from CSV file.
        
        Returns:
            Dict with import results including success count, error count, and details
        """
        results = {
            "total_rows": 0,
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
        
        try:
            # Decode and parse CSV
            content = file_content.decode('utf-8')
            reader = csv.DictReader(StringIO(content))
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
                    
                    # Check for duplicates by admission_number or email
                    existing = None
                    if row.get("admission_number"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.admission_number == row["admission_number"],
                            )
                        )
                        existing = existing_result.scalar_one_or_none()
                    
                    if not existing and row.get("email"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.email == row["email"],
                            )
                        )
                        existing = existing_result.scalar_one_or_none()
                    
                    if existing:
                        if update_existing:
                            # Update existing student
                            self._update_student_from_row(existing, row)
                            results["updated"] += 1
                        elif skip_duplicates:
                            results["skipped"] += 1
                        else:
                            results["errors"].append({
                                "row": row_num,
                                "error": f"Duplicate student: {row.get('admission_number') or row.get('email')}"
                            })
                        continue
                    
                    # Create new student
                    student = self._create_student_from_row(tenant_id, row)
                    self.db.add(student)
                    results["imported"] += 1
                    
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
    
    def _create_student_from_row(self, tenant_id: str, row: Dict[str, str]) -> Student:
        """Create a Student object from a CSV row."""
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
            guardian_name=row.get("guardian_name", "").strip() or None,
            guardian_phone=row.get("guardian_phone", "").strip() or None,
            guardian_email=row.get("guardian_email", "").strip() or None,
            address=row.get("address_line1", "").strip() or None,
            city=row.get("city", "").strip() or None,
            state=row.get("state", "").strip() or None,
            postal_code=row.get("postal_code", "").strip() or None,
            status=StudentStatus.ACTIVE,
        )
    
    def _update_student_from_row(self, student: Student, row: Dict[str, str]):
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
        if row.get("guardian_name"):
            student.guardian_name = row["guardian_name"].strip()
    
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
        Import students from Excel file.
        """
        if not self.has_pandas:
            raise RuntimeError("pandas is required for Excel import")
        
        import pandas as pd
        
        results = {
            "total_rows": 0,
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
        
        try:
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
                        else:
                            row_dict[key] = str(value)
                    
                    # Validate required fields
                    if not row_dict.get("first_name"):
                        results["errors"].append({
                            "row": row_num,
                            "error": "first_name is required"
                        })
                        continue
                    
                    # Check for duplicates
                    existing = None
                    if row_dict.get("admission_number"):
                        existing_result = await self.db.execute(
                            select(Student).where(
                                Student.tenant_id == tenant_id,
                                Student.admission_number == row_dict["admission_number"],
                            )
                        )
                        existing = existing_result.scalar_one_or_none()
                    
                    if existing:
                        if update_existing:
                            self._update_student_from_row(existing, row_dict)
                            results["updated"] += 1
                        elif skip_duplicates:
                            results["skipped"] += 1
                        else:
                            results["errors"].append({
                                "row": row_num,
                                "error": f"Duplicate student: {row_dict.get('admission_number')}"
                            })
                        continue
                    
                    # Create new student
                    student = self._create_student_from_row(tenant_id, row_dict)
                    self.db.add(student)
                    results["imported"] += 1
                    
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
