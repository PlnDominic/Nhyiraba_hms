-- Add missing permissions for Restaurant, Services, Inventory, and Tasks pages
-- Run this in Supabase SQL Editor to add permissions that show up in Access Control

-- Add new permissions
INSERT INTO permissions (name, description) VALUES
    -- Restaurant/Bar permissions
    ('manage_restaurant', 'Create, update, and manage restaurant/bar operations, orders, and menu'),
    ('view_restaurant', 'View restaurant orders, menu items, and tables (read-only)'),
    
    -- Services permissions
    ('manage_services', 'Create, update, and manage hotel service requests'),
    ('view_services', 'View service requests and their status (read-only)'),
    
    -- Inventory permissions
    ('manage_inventory', 'Add, update, and manage inventory items and stock levels'),
    ('view_inventory', 'View inventory items and stock levels (read-only)'),
    
    -- Tasks permissions
    ('manage_tasks', 'Create, assign, and manage staff tasks'),
    ('view_tasks', 'View assigned tasks and task status (read-only)')
ON CONFLICT (name) DO NOTHING;

-- Verify the new permissions were added
SELECT 
    id,
    name,
    description
FROM permissions
ORDER BY name;

-- Optional: Grant restaurant permissions to Food & Beverage staff
-- Uncomment if you want to automatically assign permissions by department

-- UPDATE user_permissions up
-- SET permission_id IN (
--     SELECT id FROM permissions 
--     WHERE name IN ('manage_restaurant', 'view_restaurant', 'manage_inventory', 'view_inventory')
-- )
-- WHERE user_id IN (
--     SELECT user_id FROM user_profiles 
--     WHERE department = 'food_beverage'
-- );
