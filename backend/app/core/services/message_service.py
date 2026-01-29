"""
Message Service - Handles bulk messaging and recipient resolution for class-based filtering.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from app.models import Student, Staff, User, SchoolClass
from app.models.staff import staff_classes  # Import the association table
from app.models.message import Message

logger = logging.getLogger(__name__)


def to_uuid(value) -> UUID:
    """Safely convert a value to UUID, handling both strings and UUID objects."""
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


class MessageService:
    """Service for managing messages and bulk messaging operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_students_by_classes(
        self,
        tenant_id: str,
        class_ids: List[str]
    ) -> List[dict]:
        """
        Get all students from specified classes.
        Returns list of dicts with id, name, email.
        """
        try:
            class_uuids = [to_uuid(cid) for cid in class_ids]
            
            result = await self.db.execute(
                select(Student).where(
                    and_(
                        Student.tenant_id == to_uuid(tenant_id),
                        Student.class_id.in_(class_uuids),
                        Student.status == 'active'
                    )
                )
            )
            students = result.scalars().all()
            
            return [
                {
                    "id": str(s.id),
                    "name": s.full_name,
                    "email": s.email,
                    "type": "student"
                }
                for s in students
            ]
        except Exception as e:
            logger.error(f"Error getting students by class: {e}")
            return []
    
    async def get_parents_by_classes(
        self,
        tenant_id: str,
        class_ids: List[str]
    ) -> List[dict]:
        """
        Get parents of students from specified classes.
        Returns list of dicts with parent contact info.
        """
        try:
            class_uuids = [to_uuid(cid) for cid in class_ids]
            
            result = await self.db.execute(
                select(Student).where(
                    and_(
                        Student.tenant_id == to_uuid(tenant_id),
                        Student.class_id.in_(class_uuids),
                        Student.status == 'active'
                    )
                )
            )
            students = result.scalars().all()
            
            # Get unique parents (by email)
            parents = {}
            for s in students:
                # Father
                if s.father_name and s.father_phone:
                    key = s.father_phone
                    if key not in parents:
                        parents[key] = {
                            "id": str(s.id),  # Link to student ID
                            "name": s.father_name,
                            "email": s.parent_email or "",
                            "phone": s.father_phone,
                            "type": "parent",
                            "student_name": s.full_name
                        }
                
                # Mother
                if s.mother_name and s.mother_phone:
                    key = s.mother_phone
                    if key not in parents:
                        parents[key] = {
                            "id": str(s.id),
                            "name": s.mother_name,
                            "email": s.parent_email or "",
                            "phone": s.mother_phone,
                            "type": "parent",
                            "student_name": s.full_name
                        }
                
                # Guardian
                if s.guardian_name and s.guardian_phone:
                    key = s.guardian_phone
                    if key not in parents:
                        parents[key] = {
                            "id": str(s.id),
                            "name": s.guardian_name,
                            "email": s.guardian_email or "",
                            "phone": s.guardian_phone,
                            "type": "parent",
                            "student_name": s.full_name
                        }
            
            return list(parents.values())
        except Exception as e:
            logger.error(f"Error getting parents by class: {e}")
            return []
    
    async def get_teachers_by_classes(
        self,
        tenant_id: str,
        class_ids: List[str]
    ) -> List[dict]:
        """
        Get teachers associated with specified classes.
        Returns list of dicts with id, name, email.
        """
        try:
            class_uuids = [to_uuid(cid) for cid in class_ids]
            
            # Get teachers through staff-class association table
            result = await self.db.execute(
                select(Staff).join(
                    staff_classes,
                    Staff.id == staff_classes.c.staff_id
                ).where(
                    and_(
                        Staff.tenant_id == to_uuid(tenant_id),
                        staff_classes.c.class_id.in_(class_uuids),
                        Staff.status == 'active'
                    )
                ).distinct()
            )
            teachers = result.scalars().all()
            
            # Also get class teachers
            class_result = await self.db.execute(
                select(SchoolClass).where(
                    and_(
                        SchoolClass.tenant_id == to_uuid(tenant_id),
                        SchoolClass.id.in_(class_uuids)
                    )
                )
            )
            classes = class_result.scalars().all()
            
            teacher_ids = {str(t.id) for t in teachers}
            
            for cls in classes:
                if cls.class_teacher_id and str(cls.class_teacher_id) not in teacher_ids:
                    # Fetch the class teacher
                    tr = await self.db.execute(
                        select(Staff).where(Staff.id == cls.class_teacher_id)
                    )
                    class_teacher = tr.scalar_one_or_none()
                    if class_teacher:
                        teachers.append(class_teacher)
                        teacher_ids.add(str(class_teacher.id))
            
            return [
                {
                    "id": str(t.id),
                    "name": f"{t.first_name} {t.last_name}",
                    "email": t.email,
                    "type": "teacher"
                }
                for t in teachers
            ]
        except Exception as e:
            logger.error(f"Error getting teachers by class: {e}")
            return []
    
    async def get_recipients_by_class_and_roles(
        self,
        tenant_id: str,
        class_ids: List[str],
        recipient_roles: List[str]
    ) -> List[dict]:
        """
        Get all recipients based on class IDs and roles.
        
        Args:
            tenant_id: Tenant UUID string
            class_ids: List of class UUID strings
            recipient_roles: List of roles ('students', 'parents', 'teachers')
        
        Returns:
            List of recipient dicts with id, name, email, type
        """
        recipients = []
        
        if 'students' in recipient_roles:
            students = await self.get_students_by_classes(tenant_id, class_ids)
            recipients.extend(students)
        
        if 'parents' in recipient_roles:
            parents = await self.get_parents_by_classes(tenant_id, class_ids)
            recipients.extend(parents)
        
        if 'teachers' in recipient_roles:
            teachers = await self.get_teachers_by_classes(tenant_id, class_ids)
            recipients.extend(teachers)
        
        return recipients
    
    async def get_recipient_count_by_class_and_roles(
        self,
        tenant_id: str,
        class_ids: List[str],
        recipient_roles: List[str]
    ) -> dict:
        """
        Get count of recipients by class and roles (for preview before sending).
        """
        counts = {
            "students": 0,
            "parents": 0,
            "teachers": 0,
            "total": 0
        }
        
        if 'students' in recipient_roles:
            students = await self.get_students_by_classes(tenant_id, class_ids)
            counts["students"] = len(students)
        
        if 'parents' in recipient_roles:
            parents = await self.get_parents_by_classes(tenant_id, class_ids)
            counts["parents"] = len(parents)
        
        if 'teachers' in recipient_roles:
            teachers = await self.get_teachers_by_classes(tenant_id, class_ids)
            counts["teachers"] = len(teachers)
        
        counts["total"] = counts["students"] + counts["parents"] + counts["teachers"]
        
        return counts
    
    async def create_bulk_messages(
        self,
        tenant_id: str,
        recipients: List[dict],
        subject: str,
        body: str,
        priority: str = "normal",
        is_important: bool = False,
        sender_name: str = "Admin",
        sender_email: str = "admin@school.edu",
        recipient_type: str = "bulk"
    ) -> dict:
        """
        Create messages for multiple recipients.
        
        Returns:
            Dict with created count and any errors
        """
        created = 0
        errors = []
        
        for recipient in recipients:
            try:
                message = Message(
                    tenant_id=to_uuid(tenant_id),
                    recipient_id=to_uuid(recipient["id"]) if recipient.get("id") else None,
                    recipient_name=recipient.get("name", ""),
                    recipient_email=recipient.get("email", ""),
                    recipient_type=recipient_type,
                    subject=subject,
                    body=body,
                    priority=priority,
                    is_important=is_important,
                    status="sent",
                    sent_at=datetime.utcnow(),
                    sender_name=sender_name,
                    sender_email=sender_email,
                    is_starred=False,
                )
                
                self.db.add(message)
                created += 1
            except Exception as e:
                errors.append({
                    "recipient": recipient.get("name", "Unknown"),
                    "error": str(e)
                })
        
        if created > 0:
            await self.db.commit()
        
        return {
            "created": created,
            "failed": len(errors),
            "errors": errors
        }
