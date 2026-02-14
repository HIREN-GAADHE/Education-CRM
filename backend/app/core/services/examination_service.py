"""
Examination service for managing exams, results, and grades.
"""
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
import statistics

from app.models.examination import (
    Examination,
    ExamResult,
    GradeScale,
    GradeLevel,
    StudentGPA,
    ExamType,
    ExamStatus,
)
from app.models.student import Student

logger = logging.getLogger(__name__)


class ExaminationService:
    """
    Service for managing examinations and results.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ============== Grade Scales ==============
    
    async def get_grade_scales(
        self,
        tenant_id: str,
        active_only: bool = True,
    ) -> List[GradeScale]:
        """Get all grade scales for a tenant."""
        query = select(GradeScale).where(GradeScale.tenant_id == tenant_id)
        
        if active_only:
            query = query.where(GradeScale.is_active == True)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_default_grade_scale(
        self,
        tenant_id: str,
    ) -> Optional[GradeScale]:
        """Get the default grade scale for a tenant."""
        result = await self.db.execute(
            select(GradeScale).where(
                GradeScale.tenant_id == tenant_id,
                GradeScale.is_default == True,
                GradeScale.is_active == True,
            )
        )
        return result.scalar_one_or_none()
    
    async def get_grade_levels(
        self,
        scale_id: str,
    ) -> List[GradeLevel]:
        """Get all grade levels for a scale."""
        result = await self.db.execute(
            select(GradeLevel).where(
                GradeLevel.scale_id == scale_id
            ).order_by(GradeLevel.order, GradeLevel.min_value.desc())
        )
        return list(result.scalars().all())
    
    async def create_grade_scale(
        self,
        tenant_id: str,
        name: str,
        levels: List[Dict[str, Any]],
        **kwargs,
    ) -> GradeScale:
        """Create a grade scale with levels."""
        scale = GradeScale(
            tenant_id=tenant_id,
            name=name,
            **kwargs,
        )
        self.db.add(scale)
        await self.db.flush()  # Get the ID
        
        # Create levels
        for level_data in levels:
            level = GradeLevel(
                tenant_id=tenant_id,
                scale_id=scale.id,
                **level_data,
            )
            self.db.add(level)
        
        await self.db.commit()
        await self.db.refresh(scale)
        return scale
    
    # ============== Examinations ==============
    
    async def get_examinations(
        self,
        tenant_id: str,
        page: int = 1,
        page_size: int = 20,
        class_name: Optional[str] = None,
        exam_type: Optional[ExamType] = None,
        status: Optional[ExamStatus] = None,
        academic_year: Optional[str] = None,
    ) -> Tuple[List[Examination], int]:
        """Get examinations with filters."""
        query = select(Examination).where(Examination.tenant_id == tenant_id)
        count_query = select(func.count(Examination.id)).where(Examination.tenant_id == tenant_id)
        
        if class_name:
            query = query.where(Examination.class_name == class_name)
            count_query = count_query.where(Examination.class_name == class_name)
        
        if exam_type:
            query = query.where(Examination.exam_type == exam_type)
            count_query = count_query.where(Examination.exam_type == exam_type)
        
        if status:
            query = query.where(Examination.status == status)
            count_query = count_query.where(Examination.status == status)
        
        if academic_year:
            query = query.where(Examination.academic_year == academic_year)
            count_query = count_query.where(Examination.academic_year == academic_year)
        
        # Get total
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Paginate
        query = query.order_by(Examination.exam_date.desc(), Examination.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        exams = list(result.scalars().all())
        
        return exams, total
    
    async def create_examination(
        self,
        tenant_id: str,
        created_by_id: str,
        **kwargs,
    ) -> Examination:
        """Create a new examination."""
        exam = Examination(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            **kwargs,
        )
        self.db.add(exam)
        await self.db.commit()
        await self.db.refresh(exam)
        return exam
    
    async def update_status(
        self,
        exam_id: str,
        status: ExamStatus,
        tenant_id: str,
    ) -> Examination:
        """Update examination status."""
        result = await self.db.execute(
            select(Examination).where(
                Examination.id == exam_id,
                Examination.tenant_id == tenant_id,
            )
        )
        exam = result.scalar_one_or_none()
        
        if exam:
            exam.status = status
            await self.db.commit()
            await self.db.refresh(exam)
        
        return exam
    
    # ============== Results ==============
    
    async def enter_result(
        self,
        tenant_id: str,
        examination_id: str,
        student_id: str,
        entered_by_id: str,
        marks_obtained: Optional[float] = None,
        is_absent: bool = False,
        is_exempted: bool = False,
        exemption_reason: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> ExamResult:
        """Enter or update a single exam result."""
        # Get examination first for validation
        exam_result = await self.db.execute(
            select(Examination).where(
                Examination.id == examination_id,
                Examination.tenant_id == tenant_id,
            )
        )
        exam = exam_result.scalar_one_or_none()
        
        if not exam:
            raise ValueError("Examination not found")
        
        # Validate marks do not exceed max_marks
        if marks_obtained is not None:
            if marks_obtained < 0:
                raise ValueError("Marks cannot be negative")
            if marks_obtained > exam.max_marks:
                raise ValueError(f"Marks cannot exceed maximum marks ({exam.max_marks})")
        
        # Check if result exists
        existing_result = await self.db.execute(
            select(ExamResult).where(
                ExamResult.examination_id == examination_id,
                ExamResult.student_id == student_id,
            )
        )
        result = existing_result.scalar_one_or_none()
        
        if result:
            # Update existing
            result.marks_obtained = marks_obtained
            result.is_absent = is_absent
            result.is_exempted = is_exempted
            result.exemption_reason = exemption_reason
            result.remarks = remarks
            result.modified_by_id = entered_by_id
            result.modified_at = datetime.utcnow()
        else:
            # Create new
            result = ExamResult(
                tenant_id=tenant_id,
                examination_id=examination_id,
                student_id=student_id,
                marks_obtained=marks_obtained,
                is_absent=is_absent,
                is_exempted=is_exempted,
                exemption_reason=exemption_reason,
                remarks=remarks,
                entered_by_id=entered_by_id,
            )
            self.db.add(result)
        
        # Calculate percentage and grade
        if marks_obtained is not None:
            result.percentage = (marks_obtained / exam.max_marks) * 100
            
            # Calculate pass/fail status
            if exam.passing_marks is not None:
                result.is_passed = marks_obtained >= exam.passing_marks
            else:
                # Default: 35% passing
                result.is_passed = result.percentage >= 35
            
            # Get grade if scale is defined
            if exam.grade_scale_id:
                levels = await self.get_grade_levels(str(exam.grade_scale_id))
                for level in levels:
                    if level.min_value <= result.percentage <= level.max_value:
                        result.grade = level.grade
                        result.grade_point = level.grade_point
                        break
        else:
            # Absent or exempted - not passed unless exempted
            result.is_passed = is_exempted
        
        await self.db.commit()
        await self.db.refresh(result)
        return result
    
    async def enter_bulk_results(
        self,
        tenant_id: str,
        examination_id: str,
        results: List[Dict[str, Any]],
        entered_by_id: str,
    ) -> Dict[str, Any]:
        """Enter multiple exam results."""
        entered = 0
        updated = 0
        errors = []
        
        for result_data in results:
            try:
                # Check if result exists
                existing = await self.db.execute(
                    select(ExamResult).where(
                        ExamResult.examination_id == examination_id,
                        ExamResult.student_id == result_data.get("student_id"),
                    )
                )
                is_update = existing.scalar_one_or_none() is not None
                
                await self.enter_result(
                    tenant_id=tenant_id,
                    examination_id=examination_id,
                    entered_by_id=entered_by_id,
                    **result_data,
                )
                if is_update:
                    updated += 1
                else:
                    entered += 1
            except Exception as e:
                errors.append({
                    "student_id": str(result_data.get("student_id")),
                    "error": str(e),
                })
        
        # Calculate ranks after all results are entered
        await self._calculate_ranks(examination_id)
        
        return {
            "success": True,
            "total": len(results),
            "created": entered,
            "updated": updated,
            "errors": errors,
        }
    
    async def _calculate_ranks(self, examination_id: str) -> None:
        """Calculate and update ranks for all results in an examination."""
        # Get all results ordered by marks (descending)
        results_query = await self.db.execute(
            select(ExamResult).where(
                ExamResult.examination_id == examination_id,
                ExamResult.is_absent == False,
                ExamResult.marks_obtained.isnot(None),
            ).order_by(ExamResult.marks_obtained.desc())
        )
        results = list(results_query.scalars().all())
        
        # Assign ranks (handle ties)
        current_rank = 0
        previous_marks = None
        students_at_rank = 0
        
        for result in results:
            students_at_rank += 1
            if result.marks_obtained != previous_marks:
                current_rank = students_at_rank
                previous_marks = result.marks_obtained
            result.rank = current_rank
        
        await self.db.commit()
    
    async def delete_result(
        self,
        examination_id: str,
        result_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a single exam result."""
        result = await self.db.execute(
            select(ExamResult).where(
                ExamResult.id == result_id,
                ExamResult.examination_id == examination_id,
                ExamResult.tenant_id == tenant_id,
            )
        )
        exam_result = result.scalar_one_or_none()
        
        if not exam_result:
            raise ValueError("Result not found")
        
        await self.db.delete(exam_result)
        await self.db.commit()
        
        # Recalculate ranks after deletion
        await self._calculate_ranks(examination_id)
        
        return True
    
    async def get_result_by_id(
        self,
        result_id: str,
        tenant_id: str,
    ) -> Optional[ExamResult]:
        """Get a single result by ID."""
        result = await self.db.execute(
            select(ExamResult).where(
                ExamResult.id == result_id,
                ExamResult.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()
    
    async def get_results(
        self,
        examination_id: str,
    ) -> List[ExamResult]:
        """Get all results for an examination."""
        result = await self.db.execute(
            select(ExamResult).where(
                ExamResult.examination_id == examination_id
            ).order_by(ExamResult.marks_obtained.desc())
        )
        return list(result.scalars().all())
    
    async def get_exam_statistics(
        self,
        examination_id: str,
    ) -> Dict[str, Any]:
        """Calculate statistics for an examination."""
        results = await self.get_results(examination_id)
        
        # Get examination
        exam_result = await self.db.execute(
            select(Examination).where(Examination.id == examination_id)
        )
        exam = exam_result.scalar_one_or_none()
        
        if not exam or not results:
            return {}
        
        # Calculate stats
        marks = [r.marks_obtained for r in results if r.marks_obtained is not None and not r.is_absent]
        
        total_students = len(results)
        appeared = len(marks)
        absent = sum(1 for r in results if r.is_absent)
        exempted = sum(1 for r in results if r.is_exempted)
        
        passing_marks = exam.passing_marks or (exam.max_marks * 0.35)
        passed = sum(1 for m in marks if m >= passing_marks)
        failed = appeared - passed
        
        # Grade distribution
        grade_dist = {}
        for r in results:
            if r.grade:
                grade_dist[r.grade] = grade_dist.get(r.grade, 0) + 1
        
        stats = {
            "exam_id": str(exam.id),
            "exam_name": exam.name,
            "total_students": total_students,
            "appeared": appeared,
            "absent": absent,
            "exempted": exempted,
            "passed": passed,
            "failed": failed,
            "pass_percentage": (passed / appeared * 100) if appeared > 0 else 0,
            "average_marks": statistics.mean(marks) if marks else 0,
            "highest_marks": max(marks) if marks else 0,
            "lowest_marks": min(marks) if marks else 0,
            "median_marks": statistics.median(marks) if marks else None,
            "standard_deviation": statistics.stdev(marks) if len(marks) > 1 else None,
            "grade_distribution": grade_dist,
        }
        
        return stats
    
    # ============== Transcript & GPA ==============
    
    async def get_student_transcript(
        self,
        tenant_id: str,
        student_id: str,
        academic_year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate student transcript."""
        # Get student
        student_result = await self.db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise ValueError("Student not found")
        
        # Get all results for the student
        query = select(ExamResult).where(
            ExamResult.tenant_id == tenant_id,
            ExamResult.student_id == student_id,
        )
        
        result = await self.db.execute(query)
        exam_results = list(result.scalars().all())
        
        # Group by term
        terms_data = {}
        total_marks = 0
        total_max = 0
        
        for er in exam_results:
            # Get exam details
            exam_detail = await self.db.execute(
                select(Examination).where(Examination.id == er.examination_id)
            )
            exam = exam_detail.scalar_one_or_none()
            
            if not exam:
                continue
            
            if academic_year and exam.academic_year != academic_year:
                continue
            
            term_key = exam.term or "Default"
            if term_key not in terms_data:
                terms_data[term_key] = {
                    "term": term_key,
                    "exams": [],
                    "total_marks": 0,
                    "obtained_marks": 0,
                }
            
            status = "pass"
            if er.is_absent:
                status = "absent"
            elif er.is_exempted:
                status = "exempted"
            elif exam.passing_marks and er.marks_obtained:
                if er.marks_obtained < exam.passing_marks:
                    status = "fail"
            
            terms_data[term_key]["exams"].append({
                "exam_name": exam.name,
                "exam_type": exam.exam_type.value,
                "subject_name": exam.subject_name,
                "max_marks": exam.max_marks,
                "marks_obtained": er.marks_obtained,
                "grade": er.grade,
                "grade_point": er.grade_point,
                "percentage": er.percentage,
                "status": status,
            })
            
            terms_data[term_key]["total_marks"] += exam.max_marks
            terms_data[term_key]["obtained_marks"] += er.marks_obtained or 0
            
            total_max += exam.max_marks
            total_marks += er.marks_obtained or 0
        
        # Calculate term percentages
        terms = []
        for term_key, term_data in terms_data.items():
            term_data["percentage"] = (
                (term_data["obtained_marks"] / term_data["total_marks"]) * 100
                if term_data["total_marks"] > 0 else 0
            )
            terms.append(term_data)
        
        overall_percentage = (total_marks / total_max * 100) if total_max > 0 else 0
        
        return {
            "student_id": str(student.id),
            "student_name": f"{student.first_name} {student.last_name or ''}".strip(),
            "student_roll_number": student.roll_number,
            "class_name": student.class_name,
            "section": student.section,
            "academic_year": academic_year or "All Years",
            "terms": terms,
            "overall_gpa": None,  # Would calculate from grade points
            "cgpa": None,
            "overall_percentage": overall_percentage,
            "overall_grade": None,  # Would get from grade scale
            "rank_in_class": None,
            "generated_at": datetime.utcnow(),
        }
    
    async def calculate_gpa(
        self,
        tenant_id: str,
        student_id: str,
        academic_year: str,
        term: Optional[str] = None,
    ) -> StudentGPA:
        """Calculate and store GPA for a student."""
        # Get all results for the period - JOIN with Examination to filter by academic_year
        query = (
            select(ExamResult)
            .join(Examination, ExamResult.examination_id == Examination.id)
            .where(
                ExamResult.tenant_id == tenant_id,
                ExamResult.student_id == student_id,
                Examination.academic_year == academic_year,
            )
        )
        
        # Filter by term if specified
        if term:
            query = query.where(Examination.term == term)
        
        result = await self.db.execute(query)
        exam_results = list(result.scalars().all())
        
        # Calculate weighted GPA
        total_grade_points = 0
        total_credits = 0
        earned_credits = 0
        
        for er in exam_results:
            # Get exam to check weightage/credits
            exam_detail = await self.db.execute(
                select(Examination).where(Examination.id == er.examination_id)
            )
            exam = exam_detail.scalar_one_or_none()
            
            if exam and er.grade_point is not None:
                # Use weightage as credit (default 1.0 if not specified)
                credit = exam.weightage / 100 if exam.weightage else 1.0
                total_grade_points += er.grade_point * credit
                total_credits += credit
                
                # Count earned credits only for passing students
                if exam.passing_marks and er.marks_obtained is not None:
                    if er.marks_obtained >= exam.passing_marks:
                        earned_credits += credit
                else:
                    earned_credits += credit  # If no passing marks defined, count as earned
        
        gpa = total_grade_points / total_credits if total_credits > 0 else 0
        
        # Check if GPA record exists
        existing = await self.db.execute(
            select(StudentGPA).where(
                StudentGPA.student_id == student_id,
                StudentGPA.academic_year == academic_year,
                StudentGPA.term == term,
            )
        )
        student_gpa = existing.scalar_one_or_none()
        
        if student_gpa:
            student_gpa.gpa = round(gpa, 2)
            student_gpa.total_credits = round(total_credits, 2)
            student_gpa.earned_credits = round(earned_credits, 2)
            student_gpa.is_calculated = True
            student_gpa.calculated_at = datetime.utcnow()
        else:
            student_gpa = StudentGPA(
                tenant_id=tenant_id,
                student_id=student_id,
                academic_year=academic_year,
                term=term,
                gpa=round(gpa, 2),
                total_credits=round(total_credits, 2),
                earned_credits=round(earned_credits, 2),
                is_calculated=True,
                calculated_at=datetime.utcnow(),
            )
            self.db.add(student_gpa)
        
        await self.db.commit()
        await self.db.refresh(student_gpa)
        
        return student_gpa
