from sqlalchemy import create_engine, text
from app.config.settings import settings

def create_learning_tables():
    # Force sync driver for this script
    db_url = settings.DATABASE_URL.replace('+asyncpg', '')
    engine = create_engine(db_url)
    
    print("Creating/Updating Learning Hub tables...")
    
    with engine.connect() as connection:
        # 1. Create ENUM type if not exists
        try:
            connection.execute(text("CREATE TYPE contenttype AS ENUM ('video', 'document', 'link');"))
            print("Created contenttype enum.")
        except Exception:
            print("Enum type might already exist, skipping...")

        # 2. Create Learning Modules Table (with FK)
        # Note: We use IF NOT EXISTS. If table exists, this is skipped.
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS learning_modules (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                thumbnail VARCHAR(255),
                category VARCHAR(100),
                is_published BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # 3. Create Learning Contents Table (with FKs)
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS learning_contents (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                module_id UUID NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content_type contenttype DEFAULT 'video',
                content_url TEXT NOT NULL,
                duration_seconds INTEGER,
                "order" INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # 4. Patch: Ensure FK constraints exist (for existing tables)
        # Check and add FK for learning_modules.tenant_id
        try:
            connection.execute(text("""
                ALTER TABLE learning_modules 
                ADD CONSTRAINT fk_learning_modules_tenant 
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
            """))
            print("Added FK constraint to learning_modules.")
        except Exception:
            # Constraint/Key likely exists or name collision
            connection.rollback()
            connection.begin()

        # Check and add FK for learning_contents.tenant_id
        try:
            connection.execute(text("""
                ALTER TABLE learning_contents 
                ADD CONSTRAINT fk_learning_contents_tenant 
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
            """))
            print("Added FK constraint to learning_contents.")
        except Exception:
            connection.rollback()
            connection.begin()

        # Check and add FK for learning_contents.module_id (if missed)
        try:
            connection.execute(text("""
                ALTER TABLE learning_contents 
                ADD CONSTRAINT fk_learning_contents_module 
                FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE;
            """))
            print("Added Module FK constraint to learning_contents.")
        except Exception:
            connection.rollback()
            connection.begin()
            
        connection.commit()
        print("Learning Hub tables verified/updated successfully!")

if __name__ == "__main__":
    create_learning_tables()
