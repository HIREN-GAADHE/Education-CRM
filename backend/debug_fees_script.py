import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from sqlalchemy import select, func
from app.config.database import async_session_factory
from app.models.academic import SchoolClass
from app.models.student import Student
from app.models.fee import FeePayment

async def debug_fees():
    async with async_session_factory() as db:
        print("--- Debugging Fees Module ---")
        
        # 1. Find the target "10-A" class
        # Try finding classes with "10" and "A"
        stmt = select(SchoolClass).where(SchoolClass.name.ilike("%10%"), SchoolClass.section.ilike("%A%"))
        result = await db.execute(stmt)
        target_classes = result.scalars().all()
        
        target_class = None
        if target_classes:
            target_class = target_classes[0]
            print(f"Found Class: {target_class.name}-{target_class.section} (ID: {target_class.id})")
        else:
            print("Could not find class matching '10' and 'A'. Listing all classes:")
            classes = await db.execute(select(SchoolClass))
            for c in classes.scalars().all():
                print(f"  - {c.name} {c.section} (ID: {c.id})")
            if not target_class:
                print("Using first class found for demo only.")
                res = await db.execute(select(SchoolClass).limit(1))
                target_class = res.scalar_one_or_none()
        
        if not target_class:
            print("No classes found at all.")
            return

        print(f"\nDebugging Target Class: {target_class.name}-{target_class.section} ({target_class.id})")
        
        # 2. Count Students
        stmt = select(func.count(Student.id)).where(Student.class_id == target_class.id)
        sc = await db.execute(stmt)
        student_count = sc.scalar()
        print(f"Students in Class: {student_count}")
        
        if student_count > 0:
            # 3. Check Join Logic (FeePayment joined with Student for this class)
            print("\nChecking Join Logic (FeePayment -> Student(class_id)):")
            
            # Using outerjoin (as in fees.py)
            stmt = select(func.count(FeePayment.id)).outerjoin(Student).where(Student.class_id == target_class.id)
            res = await db.execute(stmt)
            outer_count = res.scalar()
            print(f"  Count with .outerjoin(Student).where(Student.class_id == target_class.id): {outer_count}")
            
            # Using join (as in reminders.py)
            stmt = select(func.count(FeePayment.id)).join(Student).where(Student.class_id == target_class.id)
            res = await db.execute(stmt)
            join_count = res.scalar()
            print(f"  Count with .join(Student).where(Student.class_id == target_class.id): {join_count}")
            
            # Check individual students
            print("\nSampling Students & Fees:")
            stmt = select(Student).where(Student.class_id == target_class.id).limit(3)
            res = await db.execute(stmt)
            students = res.scalars().all()
            for s in students:
                f_stmt = select(FeePayment).where(FeePayment.student_id == s.id)
                f_res = await db.execute(f_stmt)
                fees = f_res.scalars().all()
                print(f"  Student: {s.first_name} {s.last_name} (ID: {s.id}) -> {len(fees)} Fee Payments")
                if len(fees) > 0:
                     print(f"    - First Payment: {fees[0].status} {fees[0].amount}")

        else:
            print("No students found in this class to debug.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_fees())
