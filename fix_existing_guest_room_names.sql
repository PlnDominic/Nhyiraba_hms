-- Fix Existing Guest Room Names
-- This script will update all existing guests to have proper room_name values

-- 1. First, let's add the room_name column if it doesn't exist
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(50);

-- 2. Update all guests with room assignments to have proper room names
UPDATE public.guests 
SET room_name = CONCAT('Room ', r.room_number)
FROM public.rooms r
WHERE public.guests.room = r.id
AND public.guests.room IS NOT NULL;

-- 3. For any guests where the room field matches room_number instead of room ID
UPDATE public.guests 
SET room_name = CONCAT('Room ', r.room_number)
FROM public.rooms r
WHERE public.guests.room::text = r.room_number
AND public.guests.room_name IS NULL
AND public.guests.room IS NOT NULL;

-- 4. For any remaining guests with room assignments but no room_name
UPDATE public.guests 
SET room_name = CONCAT('Room ', public.guests.room)
WHERE public.guests.room IS NOT NULL 
AND public.guests.room_name IS NULL;

-- 5. Verify the results
SELECT 
    id,
    name,
    room,
    room_name,
    email,
    status
FROM public.guests 
WHERE room IS NOT NULL
ORDER BY name;
