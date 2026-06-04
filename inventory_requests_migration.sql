-- Create inventory_requests table
CREATE TABLE IF NOT EXISTS inventory_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by UUID REFERENCES auth.users(id),
    requester_name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    fulfilled_by UUID REFERENCES auth.users(id),
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_request_items table
CREATE TABLE IF NOT EXISTS inventory_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES inventory_requests(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    item_name TEXT NOT NULL,
    quantity_requested NUMERIC NOT NULL,
    quantity_approved NUMERIC,
    quantity_fulfilled NUMERIC,
    unit_of_measure TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_requests_department ON inventory_requests(department);
CREATE INDEX IF NOT EXISTS idx_inventory_requests_status ON inventory_requests(status);
CREATE INDEX IF NOT EXISTS idx_inventory_requests_created_at ON inventory_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_request_items_request_id ON inventory_request_items(request_id);

-- Enable Row Level Security
ALTER TABLE inventory_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_request_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inventory_requests
CREATE POLICY "Users can view their own department requests"
    ON inventory_requests FOR SELECT
    USING (
        auth.uid() = requested_by OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'manager' OR
                auth.users.raw_user_meta_data->>'department' = inventory_requests.department
            )
        )
    );

CREATE POLICY "Users can create requests for their department"
    ON inventory_requests FOR INSERT
    WITH CHECK (
        auth.uid() = requested_by AND
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'department' = department
        )
    );

CREATE POLICY "Admins and managers can update requests"
    ON inventory_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'manager'
            )
        )
    );

-- Create RLS policies for inventory_request_items
CREATE POLICY "Users can view request items they have access to"
    ON inventory_request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND (
                inventory_requests.requested_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM auth.users
                    WHERE auth.users.id = auth.uid()
                    AND (
                        auth.users.raw_user_meta_data->>'role' = 'admin' OR
                        auth.users.raw_user_meta_data->>'role' = 'manager'
                    )
                )
            )
        )
    );

CREATE POLICY "Users can insert request items for their requests"
    ON inventory_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND inventory_requests.requested_by = auth.uid()
        )
    );

CREATE POLICY "Admins and managers can update request items"
    ON inventory_request_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.raw_user_meta_data->>'role' = 'manager'
            )
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_requests_updated_at
    BEFORE UPDATE ON inventory_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_request_updated_at();

-- Grant permissions
GRANT ALL ON inventory_requests TO authenticated;
GRANT ALL ON inventory_request_items TO authenticated;
