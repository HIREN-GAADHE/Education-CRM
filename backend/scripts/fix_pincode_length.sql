-- Fix pincode column length from VARCHAR(10) to VARCHAR(20)

ALTER TABLE students 
ALTER COLUMN pincode TYPE VARCHAR(20);

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'pincode';
