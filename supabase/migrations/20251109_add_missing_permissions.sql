-- Migration: Add missing permissions for Restaurant, Services, Inventory, and Tasks
-- Date: 2025-11-09
-- Description: Adds permissions that were missing from the initial setup

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

-- Verify all permissions exist
DO $$
DECLARE
    permission_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO permission_count FROM permissions;
    RAISE NOTICE 'Total permissions in database: %', permission_count;
    
    -- List all permissions
    RAISE NOTICE 'Current permissions:';
    FOR permission_count IN 
        SELECT id FROM permissions ORDER BY name
    LOOP
        RAISE NOTICE '  - %: %', 
            (SELECT name FROM permissions WHERE id = permission_count),
            (SELECT description FROM permissions WHERE id = permission_count);
    END LOOP;
END $$;
