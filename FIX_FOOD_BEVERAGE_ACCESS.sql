-- Fix Food & Beverage department name to ensure access works
-- Run this in Supabase SQL Editor

-- Check current Food & Beverage staff department values
SELECT 
    user_id,
    full_name,
    department,
    role,
    position
FROM user_profiles
WHERE department LIKE '%food%' OR department LIKE '%beverage%';

-- Fix: Update any 'Food & Beverage' to 'food_beverage' (standardized format)
UPDATE user_profiles
SET department = 'food_beverage'
WHERE department IN ('Food & Beverage', 'Food&Beverage', 'food & beverage', 'Food Beverage');

-- Verify the update
SELECT 
    user_id,
    full_name,
    department,
    role,
    position
FROM user_profiles
WHERE department = 'food_beverage';

-- Expected result: All Food & Beverage staff now have 'food_beverage' as department
