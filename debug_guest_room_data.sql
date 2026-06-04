-- Debug Guest and Room Data
-- Run this script to see the actual data in your database

-- 1. Check the guests table structure and data
SELECT 
    id,
    name,
    room,
    room_name,
    email,
    phone,
    status,
    created_at
FROM public.guests 
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check the rooms table structure and data
SELECT 
    id,
    room_number,
    name,
    type,
    status,
    price
FROM public.rooms 
ORDER BY id;

-- 3. Check if there are any guests with room assignments
SELECT 
    COUNT(*) as total_guests,
    COUNT(CASE WHEN room IS NOT NULL THEN 1 END) as guests_with_rooms,
    COUNT(CASE WHEN room_name IS NOT NULL THEN 1 END) as guests_with_room_names
FROM public.guests;

-- 4. Show the specific guest from your screenshot
SELECT 
    id,
    name,
    room,
    room_name,
    email,
    phone,
    status
FROM public.guests 
WHERE name ILIKE '%Dominic%' OR email ILIKE '%dominic%';

-- 5. Try to manually join guests and rooms to see the relationship
SELECT 
    g.id as guest_id,
    g.name as guest_name,
    g.room as guest_room_field,
    g.room_name as guest_room_name_field,
    r.id as room_id,
    r.room_number as room_number,
    r.name as room_name_in_rooms_table,
    r.type as room_type
FROM public.guests g
LEFT JOIN public.rooms r ON (
    g.room = r.id OR 
    g.room::text = r.id::text OR 
    g.room::text = r.room_number
)
WHERE g.name ILIKE '%Dominic%' OR g.email ILIKE '%dominic%';
