-- SQL Script to add missing columns to database
-- Run this in your PostgreSQL client (psql, pgAdmin, etc.)

-- 1. Add class_id to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES school_classes(id);
CREATE INDEX IF NOT EXISTS ix_students_class_id ON students(class_id);

-- 2. Add soft delete columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'class_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name IN ('is_deleted', 'deleted_at', 'deleted_by');
