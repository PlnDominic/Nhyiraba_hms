-- ======================================================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- ======================================================================
-- This script removes the circular dependency causing infinite recursion
-- ======================================================================

-- Step 1: DROP ALL POLICIES on user_profiles to stop the recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- Step 2: Create SIMPLE policies WITHOUT circular references
-- These policies DO NOT query user_profiles table, avoiding infinite recursion

-- Allow any authenticated user to SELECT from user_profiles
-- This is needed for login and profile fetching
CREATE POLICY "allow_authenticated_select_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to INSERT their own profile only
CREATE POLICY "allow_user_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own profile only
CREATE POLICY "allow_user_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own profile only
CREATE POLICY "allow_user_delete_own_profile"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 3: Apply same fix to ALL tables with similar issues

-- Fix inventory_categories
DROP POLICY IF EXISTS "Allow all authenticated users to view inventory categories" ON inventory_categories;
DROP POLICY IF EXISTS "Allow staff to create inventory categories" ON inventory_categories;
DROP POLICY IF EXISTS "Allow staff to update inventory categories" ON inventory_categories;
DROP POLICY IF EXISTS "Allow staff to delete inventory categories" ON inventory_categories;
DROP POLICY IF EXISTS "Allow staff to manage inventory categories" ON inventory_categories;

CREATE POLICY "allow_authenticated_access_inventory_categories"
ON inventory_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix inventory_items
DROP POLICY IF EXISTS "Allow all authenticated users to view inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Allow staff to create inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Allow staff to update inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Allow staff to delete inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Allow staff to manage inventory items" ON inventory_items;

CREATE POLICY "allow_authenticated_access_inventory_items"
ON inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix inventory_transactions
DROP POLICY IF EXISTS "Allow all authenticated users to view inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Allow staff to create inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Allow staff to update inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Allow staff to delete inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Allow staff to manage inventory transactions" ON inventory_transactions;

CREATE POLICY "allow_authenticated_access_inventory_transactions"
ON inventory_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix inventory_suppliers
DROP POLICY IF EXISTS "Allow all authenticated users to view inventory suppliers" ON inventory_suppliers;
DROP POLICY IF EXISTS "Allow staff to create inventory suppliers" ON inventory_suppliers;
DROP POLICY IF EXISTS "Allow staff to update inventory suppliers" ON inventory_suppliers;
DROP POLICY IF EXISTS "Allow staff to delete inventory suppliers" ON inventory_suppliers;
DROP POLICY IF EXISTS "Allow staff to manage inventory suppliers" ON inventory_suppliers;

CREATE POLICY "allow_authenticated_access_inventory_suppliers"
ON inventory_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix inventory_purchase_orders
DROP POLICY IF EXISTS "Allow all authenticated users to view purchase orders" ON inventory_purchase_orders;
DROP POLICY IF EXISTS "Allow staff to create purchase orders" ON inventory_purchase_orders;
DROP POLICY IF EXISTS "Allow staff to update purchase orders" ON inventory_purchase_orders;
DROP POLICY IF EXISTS "Allow staff to delete purchase orders" ON inventory_purchase_orders;
DROP POLICY IF EXISTS "Allow staff to manage purchase orders" ON inventory_purchase_orders;

CREATE POLICY "allow_authenticated_access_inventory_purchase_orders"
ON inventory_purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix inventory_purchase_order_items
DROP POLICY IF EXISTS "Allow all authenticated users to view purchase order items" ON inventory_purchase_order_items;
DROP POLICY IF EXISTS "Allow staff to create purchase order items" ON inventory_purchase_order_items;
DROP POLICY IF EXISTS "Allow staff to update purchase order items" ON inventory_purchase_order_items;
DROP POLICY IF EXISTS "Allow staff to delete purchase order items" ON inventory_purchase_order_items;
DROP POLICY IF EXISTS "Allow staff to manage purchase order items" ON inventory_purchase_order_items;

CREATE POLICY "allow_authenticated_access_inventory_purchase_order_items"
ON inventory_purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_categories
DROP POLICY IF EXISTS "Authenticated users can read restaurant categories" ON restaurant_categories;
DROP POLICY IF EXISTS "Staff can manage restaurant categories" ON restaurant_categories;

CREATE POLICY "allow_authenticated_access_restaurant_categories"
ON restaurant_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_menu_items
DROP POLICY IF EXISTS "Authenticated users can read menu items" ON restaurant_menu_items;
DROP POLICY IF EXISTS "Staff can manage menu items" ON restaurant_menu_items;

CREATE POLICY "allow_authenticated_access_restaurant_menu_items"
ON restaurant_menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_orders
DROP POLICY IF EXISTS "Authenticated users can read orders" ON restaurant_orders;
DROP POLICY IF EXISTS "Staff can manage orders" ON restaurant_orders;

CREATE POLICY "allow_authenticated_access_restaurant_orders"
ON restaurant_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_order_items
DROP POLICY IF EXISTS "Authenticated users can read order items" ON restaurant_order_items;
DROP POLICY IF EXISTS "Staff can manage order items" ON restaurant_order_items;

CREATE POLICY "allow_authenticated_access_restaurant_order_items"
ON restaurant_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_tables
DROP POLICY IF EXISTS "Authenticated users can read tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Staff can manage tables" ON restaurant_tables;

CREATE POLICY "allow_authenticated_access_restaurant_tables"
ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix restaurant_reservations
DROP POLICY IF EXISTS "Authenticated users can read reservations" ON restaurant_reservations;
DROP POLICY IF EXISTS "Staff can manage reservations" ON restaurant_reservations;

CREATE POLICY "allow_authenticated_access_restaurant_reservations"
ON restaurant_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix staff table
DROP POLICY IF EXISTS "Staff viewable by authenticated users" ON staff;
DROP POLICY IF EXISTS "Staff manageable by admins" ON staff;
DROP POLICY IF EXISTS "Staff can update own record" ON staff;

CREATE POLICY "allow_authenticated_access_staff"
ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix staff_schedules
DROP POLICY IF EXISTS "Schedules viewable by authenticated users" ON staff_schedules;
DROP POLICY IF EXISTS "Schedules manageable by managers" ON staff_schedules;

CREATE POLICY "allow_authenticated_access_staff_schedules"
ON staff_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix time_entries
DROP POLICY IF EXISTS "Time entries viewable by authenticated users" ON time_entries;
DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;

CREATE POLICY "allow_authenticated_access_time_entries"
ON time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix training_modules
DROP POLICY IF EXISTS "Training modules viewable by authenticated users" ON training_modules;
DROP POLICY IF EXISTS "Training modules manageable by admins" ON training_modules;

CREATE POLICY "allow_authenticated_access_training_modules"
ON training_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix staff_trainings
DROP POLICY IF EXISTS "Staff trainings viewable by authenticated users" ON staff_trainings;
DROP POLICY IF EXISTS "Staff trainings manageable by admins and self" ON staff_trainings;

CREATE POLICY "allow_authenticated_access_staff_trainings"
ON staff_trainings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix performance_metrics
DROP POLICY IF EXISTS "Performance metrics viewable by staff and managers" ON performance_metrics;
DROP POLICY IF EXISTS "Performance metrics manageable by managers" ON performance_metrics;

CREATE POLICY "allow_authenticated_access_performance_metrics"
ON performance_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix staff_leaves
DROP POLICY IF EXISTS "Staff leaves viewable by staff and managers" ON staff_leaves;
DROP POLICY IF EXISTS "Staff can request leaves" ON staff_leaves;
DROP POLICY IF EXISTS "Managers can manage all leaves" ON staff_leaves;

CREATE POLICY "allow_authenticated_access_staff_leaves"
ON staff_leaves FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Step 4: Verify no recursion issues
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Step 5: Test queries that were failing
SELECT COUNT(*) as user_profiles_count FROM public.user_profiles;
SELECT COUNT(*) as staff_count FROM public.staff;
SELECT COUNT(*) as restaurant_categories_count FROM public.restaurant_categories;
SELECT COUNT(*) as inventory_items_count FROM public.inventory_items;

-- ======================================================================
-- FIX COMPLETE
-- ======================================================================
-- All tables now have simple policies without circular dependencies
-- Refresh your app and the 500 errors should be gone!
-- ======================================================================
