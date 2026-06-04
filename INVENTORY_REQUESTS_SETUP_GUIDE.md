# Inventory Requests Table Setup Guide

## 🚨 Error: Table Not Found

**Error Message:**
```
Failed to submit request: Could not find the table 'public.inventory_requests' in the schema cache
```

**Cause:** The `inventory_requests` table doesn't exist in your Supabase database.

---

## ✅ Solution: Run Database Migration

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: **Nhyiraba HMS**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

---

### Step 2: Run the Migration SQL

Copy and paste the following SQL into the SQL Editor and click **RUN**:

```sql
-- ============================================
-- INVENTORY REQUESTS SYSTEM
-- ============================================

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
```

---

### Step 3: Verify Tables Created

After running the SQL, verify the tables were created:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see two new tables:
   - `inventory_requests`
   - `inventory_request_items`

---

## 📊 Table Structure

### inventory_requests Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| requested_by | UUID | User who created the request |
| requester_name | TEXT | Name of requester |
| department | TEXT | Department making request |
| status | TEXT | pending, approved, fulfilled, rejected |
| notes | TEXT | Additional notes |
| approved_by | UUID | User who approved |
| approved_at | TIMESTAMP | When approved |
| fulfilled_by | UUID | User who fulfilled |
| fulfilled_at | TIMESTAMP | When fulfilled |
| created_at | TIMESTAMP | When created |
| updated_at | TIMESTAMP | Last updated |

### inventory_request_items Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| request_id | UUID | Links to inventory_requests |
| item_id | UUID | Links to inventory_items |
| item_name | TEXT | Name of item |
| quantity_requested | NUMERIC | Requested quantity |
| quantity_approved | NUMERIC | Approved quantity |
| quantity_fulfilled | NUMERIC | Fulfilled quantity |
| unit_of_measure | TEXT | Unit (kg, liters, pieces, etc.) |
| created_at | TIMESTAMP | When created |

---

## 🔐 Row Level Security (RLS) Policies

### Who Can Do What:

**View Requests:**
- ✅ Users can view their own requests
- ✅ Users can view requests from their department
- ✅ Admins and Managers can view all requests

**Create Requests:**
- ✅ Users can create requests for their own department
- ✅ Must be authenticated

**Update Requests:**
- ✅ Admins can update any request
- ✅ Managers can update any request
- ❌ Regular users cannot update requests

**Request Items:**
- ✅ Users can add items to their own requests
- ✅ Admins and Managers can update request items

---

## 🎯 How the System Works

### Request Workflow:

```
1. STAFF CREATES REQUEST
   ↓
   Status: pending
   ↓
2. MANAGER REVIEWS
   ↓
   Approves/Rejects
   ↓
   Status: approved or rejected
   ↓
3. INVENTORY MANAGER FULFILLS
   ↓
   Marks as fulfilled
   ↓
   Status: fulfilled
```

---

## 🧪 Test the Setup

### Test Query 1: Check Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('inventory_requests', 'inventory_request_items');
```

**Expected Result:** Should return 2 rows

---

### Test Query 2: Check RLS Policies

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('inventory_requests', 'inventory_request_items');
```

**Expected Result:** Should return 6 policies

---

### Test Query 3: Insert Test Request

```sql
-- Insert a test request (replace with your user ID)
INSERT INTO inventory_requests (
    requested_by,
    requester_name,
    department,
    status,
    notes
) VALUES (
    auth.uid(),
    'Test User',
    'Housekeeping',
    'pending',
    'Test request'
) RETURNING *;
```

---

## 🔧 Troubleshooting

### Issue 1: "uuid_generate_v4() does not exist"

**Solution:** Enable the UUID extension:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

### Issue 2: "relation auth.users does not exist"

**Solution:** This is normal in Supabase. The auth.users table is in a separate schema. The migration should still work.

---

### Issue 3: RLS Policies Not Working

**Solution:** Make sure you're logged in as an authenticated user. Test with:
```sql
SELECT auth.uid();
```

Should return your user ID, not NULL.

---

## 📱 Frontend Integration

After setting up the database, the frontend components will work:

### Components That Use This Table:

1. **InventoryRequestModal.js**
   - Create new inventory requests
   - Add items to requests

2. **TasksPage.js**
   - View pending requests
   - Approve/reject requests

3. **InventoryPage.js** (if implemented)
   - Fulfill requests
   - Track request history

---

## 🎯 Usage Example

### Creating a Request (Frontend):

```javascript
// In InventoryRequestModal.js
const { data, error } = await supabase
  .from('inventory_requests')
  .insert({
    requested_by: currentUser.id,
    requester_name: currentUser.name,
    department: currentUser.department,
    status: 'pending',
    notes: 'Need cleaning supplies'
  })
  .select()
  .single();

// Add items to the request
const { error: itemsError } = await supabase
  .from('inventory_request_items')
  .insert([
    {
      request_id: data.id,
      item_id: item1.id,
      item_name: 'Detergent',
      quantity_requested: 5,
      unit_of_measure: 'bottles'
    }
  ]);
```

---

## ✅ Verification Checklist

After running the migration:

- [ ] Tables created in Supabase
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Triggers created
- [ ] Permissions granted
- [ ] Test query successful
- [ ] Frontend can submit requests
- [ ] No more "table not found" errors

---

## 🎉 Summary

**What This Migration Does:**

1. ✅ Creates `inventory_requests` table
2. ✅ Creates `inventory_request_items` table
3. ✅ Sets up Row Level Security
4. ✅ Creates performance indexes
5. ✅ Adds auto-update triggers
6. ✅ Grants proper permissions

**After Setup:**

- Staff can create inventory requests
- Managers can approve/reject requests
- Inventory managers can fulfill requests
- All actions are tracked and audited

---

**Setup Date**: 2025-11-29  
**Status**: Ready to Deploy  
**Estimated Time**: 2-3 minutes
