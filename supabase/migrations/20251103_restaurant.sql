-- Restaurant module tables and policies

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Policies
ALTER TABLE restaurant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read restaurant categories" ON restaurant_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read menu items" ON restaurant_menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read orders" ON restaurant_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read order items" ON restaurant_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read tables" ON restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read reservations" ON restaurant_reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage restaurant categories" ON restaurant_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);
CREATE POLICY "Staff can manage menu items" ON restaurant_menu_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);
CREATE POLICY "Staff can manage orders" ON restaurant_orders FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);
CREATE POLICY "Staff can manage order items" ON restaurant_order_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);
CREATE POLICY "Staff can manage tables" ON restaurant_tables FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);
CREATE POLICY "Staff can manage reservations" ON restaurant_reservations FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'manager' OR role = 'staff'))
);

