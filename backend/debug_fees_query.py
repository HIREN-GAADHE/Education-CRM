import asyncio
import sys
import os
import logging

# Add backend to path
sys.path.append(os.getcwd())

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.config import async_session_factory
from app.models import FeePayment, Student, Tenant
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

async def test_fees_query():
    print("Starting fees query debug...")
    try:
        async with async_session_factory() as db:
            # Mock tenant_id - we need a valid one. Let's pick the first tenant found or a specific one if known
            # For debugging, we can just remove the tenant filter or find one first.
            tenant_result = await db.execute(select(Tenant).limit(1))
            tenant = tenant_result.scalar_one_or_none()
            
            tenant_id = tenant.id if tenant else None
            print(f"Using Tenant ID: {tenant_id}")

            # Replicate the query from fees.py
            print("Executing Main Query...")
            query = select(FeePayment).outerjoin(Student).options(
                selectinload(FeePayment.student).selectinload(Student.school_class)
            )
            
            if tenant_id:
                query = query.where(FeePayment.tenant_id == tenant_id)
                
            query = query.limit(10)
            
            result = await db.execute(query)
            payments = result.scalars().unique().all()
            print(f"Query successful. Found {len(payments)} payments.")
            
            for p in payments:
                print(f"Payment {p.id}, Student: {p.student.id if p.student else 'None'}")
                if p.student and p.student.school_class:
                     print(f"  Class: {p.student.school_class.class_number}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_fees_query())
