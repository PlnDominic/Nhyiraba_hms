-- New room rates (old price -> new price):
--   150 -> 170, 170 -> 200, 250 -> 270, 270 -> 290, 300 stays 300, 500 stays 500
-- One statement with CASE, so a room moved from 150 to 170 is not moved again to 200.
-- Existing reservations keep the rate they were booked at.
UPDATE public.rooms
   SET price = CASE price::numeric
                 WHEN 150 THEN 170
                 WHEN 170 THEN 200
                 WHEN 250 THEN 270
                 WHEN 270 THEN 290
               END,
       updated_at = now()
 WHERE price::numeric IN (150, 170, 250, 270);

-- Check the result
SELECT price, count(*) AS rooms FROM public.rooms GROUP BY price ORDER BY price;
