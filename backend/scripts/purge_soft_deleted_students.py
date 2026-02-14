import asyncio
import os
import sys

# Ensure backend directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

from app.config.database import AsyncSessionLocal
from app.models import Student
from app.models.fee import FeePayment
from sqlalchemy import select, delete

async def purge_deleted():
    async with AsyncSessionLocal() as db:
        try:
            print("Identifying soft-deleted students to purge...")
            # Find students marked as deleted
            stmt = select(Student.id).where(Student.is_deleted == True)
            result = await db.execute(stmt)
            deleted_ids = result.scalars().all()
            
            if not deleted_ids:
                print("No soft-deleted students available to purge.")
                # Also check orphaned fees just in case? No, risky.
                # Let's check orphaned fees linked to deleted students if possible?
                # But here deleted_ids are found.
                return

            print(f"Found {len(deleted_ids)} soft-deleted students. Cleaning up associated data...")
            
            # 1. Delete associated fees (hard delete)
            # Fetch fee IDs to report count accurately
            fee_sel = select(FeePayment.id).where(FeePayment.student_id.in_(deleted_ids))
            fee_res_ids = (await db.execute(fee_sel)).scalars().all()
            
            if fee_res_ids:
                fee_del = delete(FeePayment).where(FeePayment.id.in_(fee_res_ids))
                await db.execute(fee_del)
                print(f"Deleted {len(fee_res_ids)} associated fee records.")
            else:
                print("No associated fee records found for deleted students.")
            
            # 2. Delete students (hard delete)
            stu_del = delete(Student).where(Student.id.in_(deleted_ids))
            stu_res = await db.execute(stu_del)
            print(f"Deleted {stu_res.rowcount} student records permanently.")
            
            await db.commit()
            print("Purge completed successfully.")
            
        except Exception as e:
            print(f"Error during purge: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(purge_deleted())
