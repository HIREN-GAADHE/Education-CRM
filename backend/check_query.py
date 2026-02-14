
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from app.models import FeePayment, Student, Tenant
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

def check_query():
    print("Compiling query...")
    try:
        # Replicate the query
        query = select(FeePayment).outerjoin(Student).options(
            selectinload(FeePayment.student).selectinload(Student.school_class)
        )
        print("Query compiled successfully.")
        print(str(query))
        
        count_query = select(func.count(FeePayment.id)).outerjoin(Student)
        print("Count query compiled successfully.")
        print(str(count_query))

    except Exception as e:
        print(f"COMPILATION ERROR: {e}")

if __name__ == "__main__":
    check_query()
