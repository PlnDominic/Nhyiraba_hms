# 🚀 Quick Fix: Add Missing Permissions

## Problem
The Access Control page doesn't show permissions for Restaurant, Services, Inventory, and Tasks.

## Solution (2 minutes)

### Step 1: Open Supabase SQL Editor
Go to your Supabase Dashboard → SQL Editor

### Step 2: Copy and Run This SQL

```sql
INSERT INTO permissions (name, description) VALUES
    ('manage_restaurant', 'Create, update, and manage restaurant/bar operations, orders, and menu'),
    ('view_restaurant', 'View restaurant orders, menu items, and tables (read-only)'),
    ('manage_services', 'Create, update, and manage hotel service requests'),
    ('view_services', 'View service requests and their status (read-only)'),
    ('manage_inventory', 'Add, update, and manage inventory items and stock levels'),
    ('view_inventory', 'View inventory items and stock levels (read-only)'),
    ('manage_tasks', 'Create, assign, and manage staff tasks'),
    ('view_tasks', 'View assigned tasks and task status (read-only)')
ON CONFLICT (name) DO NOTHING;
```

### Step 3: Verify

Run this to check:

```sql
SELECT name, description FROM permissions ORDER BY name;
```

You should see **15 permissions** total (7 old + 8 new).

### Step 4: Refresh Your App

1. Go to **Access Control** in your app
2. Click on a pending access request
3. Scroll to **Permissions** section
4. You should now see:
   - ✅ Manage Restaurant
   - ✅ View Restaurant
   - ✅ Manage Services
   - ✅ View Services
   - ✅ Manage Inventory
   - ✅ View Inventory
   - ✅ Manage Tasks
   - ✅ View Tasks

## Done! 🎉

Now you can assign these permissions when creating user accounts.

---

## Who Should Get What?

**Food & Beverage Staff:**
- Manage Restaurant
- View Restaurant
- Manage Inventory
- View Inventory
- Manage Tasks

**Housekeeping:**
- Manage Services
- View Services
- Manage Tasks
- View Tasks

**Front Desk:**
- Manage Services
- Manage Tasks
- (Already have: reservations, rooms, guests, billing)

**Maintenance:**
- Manage Services
- View Services
- Manage Tasks
- View Tasks

---

**Need more help?** See `PERMISSIONS_SETUP_GUIDE.md` for detailed info.
