-- Add is_passed and rank columns to exam_results table
-- Migration created: 2026-02-07

ALTER TABLE exam_results 
ADD COLUMN IF NOT EXISTS is_passed BOOLEAN DEFAULT NULL;

ALTER TABLE exam_results 
ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT NULL;
