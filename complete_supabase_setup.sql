-- ======================================================================
-- COMPLETE SUPABASE DATABASE SETUP FOR LAVIMAC HOTEL MANAGEMENT SYSTEM
-- ======================================================================
-- This script creates all necessary tables, policies, and initial data
-- Run this in your Supabase SQL Editor
-- ======================================================================

-- ======================================================================
-- 1. ENABLE EXTENSIONS
-- ======================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================================================
-- 2. CORE AUTH AND USER MANAGEMENT TABLES
-- ======================================================================

-- Access Requests Table
CREATE TABLE IF NOT EXISTS access_requests (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    reason TEXT,
    contact_number TEXT,
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    position TEXT,
    department TEXT,
    contact_number TEXT,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Permissions Junction Table
CREATE TABLE IF NOT EXISTS user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

-- Insert Default Permissions
INSERT INTO permissions (name, description) VALUES
    ('manage_reservations', 'Create, update, and delete reservations'),
    ('manage_rooms', 'Manage room status and details'),
    ('manage_guests', 'Access and modify guest information'),
    ('manage_billing', 'Process payments and manage billing'),
    ('view_reports', 'Access reporting and analytics'),
    ('manage_staff', 'Manage staff accounts and permissions'),
    ('system_settings', 'Configure system settings')
ON CONFLICT (name) DO NOTHING;

-- ======================================================================
-- 3. ROOMS AND RESERVATIONS
-- ======================================================================

-- Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id BIGINT PRIMARY KEY,
    room_number BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Available',
    price DECIMAL(10, 2) NOT NULL,
    capacity INTEGER NOT NULL,
    amenities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON public.rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON public.rooms(type);

-- Insert Initial Room Data
INSERT INTO public.rooms (id, room_number, type, status, price, capacity, amenities)
VALUES
    -- Standard Rooms - 500 Ghana Cedis
    (101, 101, 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
    (102, 102, 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
    (103, 103, 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
    -- Superior Rooms - 750 Ghana Cedis
    (104, 104, 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
    (105, 105, 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
    (106, 106, 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
    (107, 107, 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
    (108, 108, 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
    -- Executive Room - 1,250 Ghana Cedis
    (109, 109, 'Executive', 'Available', 1250, 4, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar', 'Jacuzzi', 'Room Service'])
ON CONFLICT (id) DO NOTHING;

-- Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id BIGINT NOT NULL REFERENCES public.rooms(id),
    room_number BIGINT NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    check_in_date TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Reserved',
    room_type VARCHAR(50) NOT NULL,
    room_price DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_number ON public.reservations(room_number);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_name ON public.reservations(guest_name);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON public.reservations(check_in_date, check_out_date);

-- ======================================================================
-- 4. GUESTS
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth TEXT,
    gender TEXT,
    nationality TEXT,
    region TEXT,
    address TEXT,
    room TEXT NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'Checked In',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_room ON public.guests(room);
CREATE INDEX IF NOT EXISTS idx_guests_status ON public.guests(status);
CREATE INDEX IF NOT EXISTS idx_guests_name ON public.guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_email ON public.guests(email);

-- ======================================================================
-- 5. INVOICES AND BILLING
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    guest_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'Standard',
    nights INTEGER NOT NULL DEFAULT 1,
    room_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
    room_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    service_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    has_service_items BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    service_id BIGINT,
    item_name TEXT NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    item_date TEXT,
    item_type TEXT DEFAULT 'service',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- 6. SERVICES AND TASKS
-- ======================================================================

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    room VARCHAR(255) NOT NULL,
    service_id INTEGER REFERENCES services(id),
    service_name VARCHAR(255) NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    guest_id UUID,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_services_available ON services(available);
CREATE INDEX IF NOT EXISTS idx_service_requests_room ON service_requests(room);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_id ON service_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    room VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    assignee VARCHAR(255),
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- ======================================================================
-- 7. REPORTS
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE,
    type TEXT NOT NULL,
    format TEXT,
    generated_by TEXT,
    filename TEXT,
    file_content TEXT,
    preview_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(type);

-- ======================================================================
-- 8. INVENTORY MANAGEMENT
-- ======================================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES inventory_categories(id),
    sku TEXT,
    unit_of_measure TEXT NOT NULL,
    minimum_stock NUMERIC(10, 2) DEFAULT 0,
    reorder_point NUMERIC(10, 2) DEFAULT 0,
    current_stock NUMERIC(10, 2) DEFAULT 0,
    unit_cost NUMERIC(10, 2) DEFAULT 0,
    supplier TEXT,
    supplier_contact TEXT,
    location TEXT,
    last_ordered_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES inventory_items(id) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase','consumption','adjustment','transfer')),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2),
    total_price NUMERIC(10, 2),
    reference_number TEXT,
    notes TEXT,
    department TEXT,
    performed_by UUID REFERENCES auth.users(id),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    website TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES inventory_suppliers(id),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('draft','pending','approved','ordered','received','cancelled')),
    total_amount NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES inventory_purchase_orders(id) NOT NULL,
    item_id UUID REFERENCES inventory_items(id) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    received_quantity NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================================================================
-- 9. RESTAURANT MODULE
-- ======================================================================

CREATE TABLE IF NOT EXISTS restaurant_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category_id UUID REFERENCES restaurant_categories(id),
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    preparation_time INTEGER,
    allergens TEXT,
    ingredients TEXT,
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    calories INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number INTEGER,
    room_number INTEGER,
    guest_id UUID REFERENCES auth.users(id),
    server_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('pending','preparing','ready','delivered','completed','cancelled')),
    order_type TEXT NOT NULL CHECK (order_type IN ('dine-in','room-service','takeaway')),
    special_instructions TEXT,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES restaurant_orders(id) NOT NULL,
    menu_item_id UUID REFERENCES restaurant_menu_items(id) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    special_instructions TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number INTEGER NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance')),
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_name TEXT NOT NULL,
    guest_id UUID REFERENCES auth.users(id),
    contact_number TEXT,
    email TEXT,
    table_id UUID REFERENCES restaurant_tables(id),
    party_size INTEGER NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    special_requests TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','seated','completed','cancelled','no-show')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================================================================
-- 10. TRIGGERS AND FUNCTIONS
-- ======================================================================

-- Update modified timestamp function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER update_invoices_timestamp BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_guests_timestamp BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_services_timestamp BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_service_requests_timestamp BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_tasks_timestamp BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Inventory stock update function
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'purchase' THEN
        UPDATE inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = NOW() WHERE id = NEW.item_id;
    ELSIF NEW.transaction_type = 'consumption' THEN
        UPDATE inventory_items SET current_stock = current_stock - NEW.quantity, updated_at = NOW() WHERE id = NEW.item_id;
    ELSIF NEW.transaction_type = 'adjustment' THEN
        UPDATE inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = NOW() WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_transaction_trigger AFTER INSERT ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- Low stock items function
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
    id UUID,
    name TEXT,
    current_stock NUMERIC,
    minimum_stock NUMERIC,
    reorder_point NUMERIC,
    unit_of_measure TEXT,
    category_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.name, i.current_stock, i.minimum_stock, i.reorder_point, i.unit_of_measure, c.name as category_name
    FROM inventory_items i LEFT JOIN inventory_categories c ON i.category_id = c.id
    WHERE i.current_stock <= i.reorder_point
    ORDER BY (i.current_stock / NULLIF(i.reorder_point, 0)) ASC;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================
-- 11. ROW LEVEL SECURITY POLICIES
-- ======================================================================

-- Enable RLS on all tables
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;

-- Access Requests Policies
CREATE POLICY "Anyone can insert access requests" ON access_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view access requests" ON access_requests FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);
CREATE POLICY "Admins can update access requests" ON access_requests FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);

-- Permissions Policies
CREATE POLICY "Anyone can view permissions" ON permissions FOR SELECT USING (true);

-- User Profiles Policies
CREATE POLICY "Users can view their own profiles" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);
CREATE POLICY "Admins can insert profiles" ON user_profiles FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator')) OR auth.uid() = user_id
);
CREATE POLICY "Users can update their own profiles" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON user_profiles FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);

-- User Permissions Policies
CREATE POLICY "Users can view their own permissions" ON user_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all permissions" ON user_permissions FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);
CREATE POLICY "Admins can insert permissions" ON user_permissions FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);
CREATE POLICY "Admins can update permissions" ON user_permissions FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM user_profiles WHERE role IN ('admin','administrator'))
);

-- Rooms & Reservations Policies  
CREATE POLICY "Allow full access to authenticated users" ON public.rooms USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON public.reservations USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Guests Policies
CREATE POLICY "Allow public access to guests" ON public.guests FOR ALL USING (true);

-- Invoices Policies
CREATE POLICY "Invoices are viewable by authenticated users" ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Invoices are insertable by authenticated users" ON public.invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Invoices are updatable by authenticated users" ON public.invoices FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Invoices are deletable by authenticated users" ON public.invoices FOR DELETE USING (auth.role() = 'authenticated');

-- Invoice Items Policies
CREATE POLICY "Invoice items are viewable by authenticated users" ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Invoice items are insertable by authenticated users" ON public.invoice_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Invoice items are updatable by authenticated users" ON public.invoice_items FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Invoice items are deletable by authenticated users" ON public.invoice_items FOR DELETE USING (auth.role() = 'authenticated');

-- Services & Tasks Policies
CREATE POLICY "anon_access_services" ON services FOR ALL USING (true);
CREATE POLICY "anon_access_service_requests" ON service_requests FOR ALL USING (true);
CREATE POLICY "auth_access_services" ON services FOR ALL USING (true);
CREATE POLICY "auth_access_service_requests" ON service_requests FOR ALL USING (true);
CREATE POLICY "anon_access" ON tasks FOR ALL USING (true);
CREATE POLICY "auth_access" ON tasks FOR ALL USING (true);

-- Reports Policies
CREATE POLICY "Authenticated users can CRUD their own reports" ON public.reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read reports" ON public.reports FOR SELECT TO anon, authenticated USING (true);

-- Inventory Policies (simplified for authenticated users)
CREATE POLICY "Allow all authenticated users to view inventory categories" ON inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage inventory categories" ON inventory_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Allow all authenticated users to view inventory items" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage inventory items" ON inventory_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Allow all authenticated users to view inventory transactions" ON inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage inventory transactions" ON inventory_transactions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Allow all authenticated users to view inventory suppliers" ON inventory_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage inventory suppliers" ON inventory_suppliers FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager'))
);

CREATE POLICY "Allow all authenticated users to view purchase orders" ON inventory_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage purchase orders" ON inventory_purchase_orders FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager'))
);

CREATE POLICY "Allow all authenticated users to view purchase order items" ON inventory_purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage purchase order items" ON inventory_purchase_order_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager'))
);

-- Restaurant Policies
CREATE POLICY "Authenticated users can read restaurant categories" ON restaurant_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage restaurant categories" ON restaurant_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Authenticated users can read menu items" ON restaurant_menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage menu items" ON restaurant_menu_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Authenticated users can read orders" ON restaurant_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage orders" ON restaurant_orders FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Authenticated users can read order items" ON restaurant_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage order items" ON restaurant_order_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Authenticated users can read tables" ON restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage tables" ON restaurant_tables FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

CREATE POLICY "Authenticated users can read reservations" ON restaurant_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage reservations" ON restaurant_reservations FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

-- ======================================================================
-- 12. GRANTS
-- ======================================================================

GRANT ALL ON public.rooms TO anon, authenticated;
GRANT ALL ON public.reservations TO anon, authenticated;
GRANT ALL ON public.guests TO anon, authenticated;

-- ======================================================================
-- SETUP COMPLETE
-- ======================================================================
-- All tables, policies, triggers, and initial data have been created.
-- Your Lavimac Hotel Management System database is ready to use!
-- ======================================================================
