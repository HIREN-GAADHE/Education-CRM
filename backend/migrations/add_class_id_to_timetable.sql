-- Migration: Add class_id column to timetable_entries table
-- Date: 2026-01-18
-- Purpose: Link timetable entries to school_classes table for class-centric design

-- Add class_id column with foreign key to school_classes
ALTER TABLE timetable_entries 
ADD COLUMN class_id UUID REFERENCES school_classes(id);

-- Create index for performance
CREATE INDEX idx_timetable_entries_class_id ON timetable_entries(class_id);

-- Optional: Populate class_id from existing class_name (if you have matching data)
-- UPDATE timetable_entries te
-- SET class_id = sc.id
-- FROM school_classes sc
-- WHERE te.class_name = sc.name
-- AND te.tenant_id = sc.tenant_id;
