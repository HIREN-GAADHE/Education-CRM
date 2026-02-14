import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from app.config.database import async_session_factory
from app.models import FeePayment, Student
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def main():
    print("Starting debug script...")
    try:
        async with async_session_factory() as db:
            query = select(FeePayment).options(selectinload(FeePayment.student)).limit(5)
            result = await db.execute(query)
            payments = result.scalars().all()
            
            print(f"Found {len(payments)} payments")
            for p in payments:
                print(f"Payment ID: {p.id}")
                if p.student:
                    print(f"Student: {p.student.id} - {p.student.first_name} {p.student.last_name}")
                else:
                    print(f"Student is NONE for student_id: {p.student_id}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
