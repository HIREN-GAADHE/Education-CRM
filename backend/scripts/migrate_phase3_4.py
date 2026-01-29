"""
Standalone migration script using raw psycopg2 connection.
Does not import app modules to avoid any SQLAlchemy issues.
"""
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Simple async postgres using asyncpg
import asyncpg

async def run_migrations():
    """Run migrations directly using asyncpg."""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment")
        return
    
    # Convert postgresql:// to postgresql+asyncpg:// format back to just host/db parts
    # Example: postgresql+asyncpg://user:pass@host:port/db
    url = database_url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
    
    try:
        print(f"Connecting to database...")
        conn = await asyncpg.connect(database_url.replace("+asyncpg", ""))
        print("Connected!")
        
        # Add user_id column to students if it doesn't exist
        print("1. Adding user_id to students table...")
        try:
            await conn.execute("""
                ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL
            """)
            print("   Done!")
        except Exception as e:
            if "already exists" in str(e):
                print("   Column already exists, skipping.")
            else:
                print(f"   Error: {e}")
        
        # Create parent_students table
        print("2. Creating parent_students table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS parent_students (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                relationship_type VARCHAR(50) DEFAULT 'guardian',
                is_primary_contact BOOLEAN DEFAULT false,
                can_receive_notifications BOOLEAN DEFAULT true,
                can_receive_sms BOOLEAN DEFAULT true,
                can_receive_email BOOLEAN DEFAULT true,
                can_view_attendance BOOLEAN DEFAULT true,
                can_view_grades BOOLEAN DEFAULT true,
                can_view_fees BOOLEAN DEFAULT true,
                can_pay_fees BOOLEAN DEFAULT true,
                can_view_timetable BOOLEAN DEFAULT true,
                can_download_certificates BOOLEAN DEFAULT true,
                UNIQUE(tenant_id, parent_user_id, student_id)
            )
        """)
        print("   Done!")
        
        # Create library_books table
        print("3. Creating library_books table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS library_books (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                is_deleted BOOLEAN DEFAULT false,
                deleted_at TIMESTAMP,
                deleted_by UUID,
                isbn VARCHAR(20),
                isbn13 VARCHAR(17),
                accession_number VARCHAR(50),
                title VARCHAR(500) NOT NULL,
                subtitle VARCHAR(500),
                author VARCHAR(300) NOT NULL,
                co_authors JSONB DEFAULT '[]',
                publisher VARCHAR(200),
                publication_year INTEGER,
                edition VARCHAR(50),
                language VARCHAR(50) DEFAULT 'English',
                category VARCHAR(50) DEFAULT 'other',
                subject VARCHAR(200),
                keywords JSONB DEFAULT '[]',
                pages INTEGER,
                binding VARCHAR(50),
                rack_number VARCHAR(50),
                shelf_number VARCHAR(50),
                price FLOAT,
                description TEXT,
                cover_image_url VARCHAR(500),
                total_copies INTEGER DEFAULT 1,
                available_copies INTEGER DEFAULT 1,
                extra_data JSONB DEFAULT '{}'
            )
        """)
        print("   Done!")
        
        # Create library_book_copies table
        print("4. Creating library_book_copies table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS library_book_copies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
                barcode VARCHAR(50) NOT NULL,
                copy_number INTEGER DEFAULT 1,
                condition VARCHAR(50) DEFAULT 'good',
                is_available BOOLEAN DEFAULT true,
                is_reference_only BOOLEAN DEFAULT false,
                rack_number VARCHAR(50),
                shelf_number VARCHAR(50),
                acquisition_date DATE,
                acquisition_source VARCHAR(200),
                acquisition_price FLOAT,
                notes TEXT,
                UNIQUE(tenant_id, barcode)
            )
        """)
        print("   Done!")
        
        # Create library_members table
        print("5. Creating library_members table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS library_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                member_code VARCHAR(50) NOT NULL,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                student_id UUID REFERENCES students(id) ON DELETE SET NULL,
                staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
                member_type VARCHAR(50) DEFAULT 'student',
                name VARCHAR(200) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(20),
                membership_start DATE,
                membership_end DATE,
                is_active BOOLEAN DEFAULT true,
                max_books INTEGER DEFAULT 3,
                max_days INTEGER DEFAULT 14,
                total_fines FLOAT DEFAULT 0,
                fines_paid FLOAT DEFAULT 0,
                UNIQUE(tenant_id, member_code)
            )
        """)
        print("   Done!")
        
        # Create library_book_issues table
        print("6. Creating library_book_issues table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS library_book_issues (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE CASCADE,
                member_id UUID NOT NULL REFERENCES library_members(id) ON DELETE CASCADE,
                issue_date DATE NOT NULL,
                due_date DATE NOT NULL,
                return_date DATE,
                status VARCHAR(50) DEFAULT 'issued',
                renewal_count INTEGER DEFAULT 0,
                max_renewals INTEGER DEFAULT 2,
                fine_amount FLOAT DEFAULT 0,
                fine_paid BOOLEAN DEFAULT false,
                fine_per_day FLOAT DEFAULT 5.0,
                issued_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
                returned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
                condition_at_issue VARCHAR(50),
                condition_at_return VARCHAR(50),
                notes TEXT
            )
        """)
        print("   Done!")
        
        # Create library_settings table
        print("7. Creating library_settings table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS library_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP,
                default_issue_days INTEGER DEFAULT 14,
                max_renewals INTEGER DEFAULT 2,
                fine_per_day FLOAT DEFAULT 5.0,
                fine_on_sunday BOOLEAN DEFAULT false,
                fine_on_holidays BOOLEAN DEFAULT false,
                max_fine_per_book FLOAT,
                student_max_books INTEGER DEFAULT 3,
                staff_max_books INTEGER DEFAULT 5,
                faculty_max_books INTEGER DEFAULT 10,
                send_due_reminders BOOLEAN DEFAULT true,
                reminder_days_before INTEGER DEFAULT 2,
                send_overdue_alerts BOOLEAN DEFAULT true,
                working_hours JSONB
            )
        """)
        print("   Done!")
        
        await conn.close()
        print("\n=== All migrations applied successfully! ===")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(run_migrations())
