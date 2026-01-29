"""
Script to drop and recreate messages and reports tables with the correct schema.
Run this if you get schema mismatch errors.
"""
import asyncio
import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.config.database import engine


async def recreate_tables():
    """Drop and recreate messages and reports tables."""
    print("🔧 Recreating messages and reports tables...")
    
    async with engine.begin() as conn:
        # Drop old tables
        print("   Dropping old tables...")
        await conn.execute(text("DROP TABLE IF EXISTS messages CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS reports CASCADE"))
        
        # Drop old enum types
        print("   Dropping old enum types...")
        await conn.execute(text("DROP TYPE IF EXISTS messagestatus CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS messagepriority CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS reporttype CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS reportformat CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS reportstatus CASCADE"))
        
        # Create messages table with String columns
        print("   Creating messages table...")
        await conn.execute(text("""
            CREATE TABLE messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP,
                
                sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
                sender_name VARCHAR(200),
                sender_email VARCHAR(255),
                
                recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
                recipient_name VARCHAR(200),
                recipient_email VARCHAR(255),
                recipient_type VARCHAR(50),
                
                subject VARCHAR(500) NOT NULL,
                body TEXT NOT NULL,
                
                priority VARCHAR(20) DEFAULT 'normal',
                status VARCHAR(20) DEFAULT 'sent',
                
                sent_at TIMESTAMP,
                read_at TIMESTAMP,
                
                is_starred BOOLEAN DEFAULT FALSE,
                is_important BOOLEAN DEFAULT FALSE,
                
                parent_id UUID REFERENCES messages(id) ON DELETE SET NULL
            )
        """))
        
        # Create indexes
        await conn.execute(text("CREATE INDEX idx_messages_sender ON messages(sender_id)"))
        await conn.execute(text("CREATE INDEX idx_messages_recipient ON messages(recipient_id)"))
        await conn.execute(text("CREATE INDEX idx_messages_status ON messages(status)"))
        
        # Create reports table
        print("   Creating reports table...")
        await conn.execute(text("""
            CREATE TABLE reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP,
                
                name VARCHAR(255) NOT NULL,
                description TEXT,
                report_type VARCHAR(50) DEFAULT 'custom',
                
                parameters JSONB DEFAULT '{}',
                
                format VARCHAR(20) DEFAULT 'json',
                file_url VARCHAR(500),
                file_size INTEGER,
                
                status VARCHAR(20) DEFAULT 'pending',
                error_message TEXT,
                
                generated_by UUID,
                generated_at TIMESTAMP,
                
                data JSONB DEFAULT '{}',
                row_count INTEGER DEFAULT 0
            )
        """))
        
        # Create index
        await conn.execute(text("CREATE INDEX idx_reports_type ON reports(report_type)"))
        await conn.execute(text("CREATE INDEX idx_reports_status ON reports(status)"))
        
        print("✅ Tables recreated successfully!")


if __name__ == "__main__":
    asyncio.run(recreate_tables())
