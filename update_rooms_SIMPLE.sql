-- ============================================================
-- SIMPLE VERSION: Room Prices Update from Excel
-- No sequence manipulation - just clean insert
-- ============================================================

-- Step 1: Add block column (safe - won't error if exists)
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS block VARCHAR(100) DEFAULT 'Main Block';

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS idx_rooms_block ON public.rooms(block);

-- Step 3: Clear existing rooms
-- WARNING: This deletes all current rooms!
DELETE FROM public.rooms;

-- Step 4: Insert Main Block rooms (28 rooms)
INSERT INTO public.rooms (id, room_number, type, status, price, capacity, amenities, block) VALUES
-- GHS 300 rooms (1-12)
(1, 1, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(2, 2, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(3, 3, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(4, 4, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(5, 5, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(6, 6, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(7, 7, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(8, 8, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(9, 9, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(10, 10, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(11, 11, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),
(12, 12, 'Deluxe', 'Available', 300.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 'Main Block'),

-- GHS 270 room (13)
(13, 13, 'Superior', 'Available', 270.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning'], 'Main Block'),

-- GHS 250 rooms (14-16)
(14, 14, 'Superior', 'Available', 250.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning'], 'Main Block'),
(15, 15, 'Superior', 'Available', 250.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning'], 'Main Block'),
(16, 16, 'Superior', 'Available', 250.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning'], 'Main Block'),

-- GHS 170 rooms (17-26)
(17, 17, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(18, 18, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(19, 19, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(20, 20, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(21, 21, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(22, 22, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(23, 23, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(24, 24, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(25, 25, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(26, 26, 'Standard', 'Available', 170.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),

-- GHS 150 rooms (27-28)
(27, 27, 'Economy', 'Available', 150.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),
(28, 28, 'Economy', 'Available', 150.00, 2, ARRAY['WiFi', 'TV'], 'Main Block'),

-- Aquarian Block rooms (14 rooms) - All GHS 500
(101, 1, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(102, 2, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(103, 3, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(104, 4, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(105, 5, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(106, 6, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(107, 7, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(108, 8, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(109, 9, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(110, 10, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(111, 11, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(112, 12, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(113, 13, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block'),
(114, 14, 'Executive Suite', 'Available', 500.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Ocean View'], 'Aquarian Block');

-- Verify the results
SELECT 
    block,
    COUNT(*) as total_rooms,
    MIN(price) as min_price,
    MAX(price) as max_price
FROM public.rooms
GROUP BY block
ORDER BY block;
