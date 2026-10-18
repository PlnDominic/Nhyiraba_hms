# Supabase Database Setup Instructions

## Overview
This guide will help you set up all the necessary database tables for the Lavimac Hotel Management System in Supabase.

## Prerequisites
- Access to your Supabase project dashboard
- Project URL: `https://kqjoqkmcxvynqdsjekkc.supabase.co`

## Setup Steps

### Option 1: Using Supabase Dashboard (Recommended)

**IMPORTANT: Run these scripts in order!**

#### Step 1: Run Main Database Setup

1. **Open Supabase SQL Editor**
   - Go to https://supabase.com/dashboard
   - Select your project: `kqjoqkmcxvynqdsjekkc`
   - Click on "SQL Editor" in the left sidebar

2. **Execute the Main Setup Script**
   - Click "New Query"
   - Open the file: `complete_supabase_setup.sql`
   - Copy the entire contents of the file
   - Paste it into the SQL Editor
   - Click "Run" button (or press Ctrl+Enter)

3. **Wait for Completion**
   - The script will create all base tables, indexes, policies, and initial data
   - You should see success messages in the Results panel
   - This may take 10-30 seconds to complete

#### Step 2: Run Staff Tables Setup

1. **Create a New Query**
   - Click "New Query" again in the SQL Editor

2. **Execute the Staff Setup Script**
   - Open the file: `staff_tables_setup.sql`
   - Copy the entire contents of the file
   - Paste it into the SQL Editor
   - Click "Run" button (or press Ctrl+Enter)

3. **Wait for Completion**
   - The script will create all staff-related tables and sample staff data
   - You should see success messages in the Results panel
   - This may take 5-10 seconds to complete

4. **Verify Tables Were Created**
   - Click on "Table Editor" in the left sidebar
   - You should see all the following tables:
     
     **Core Tables:**
     - access_requests
     - permissions
     - user_profiles
     - user_permissions
     
     **Booking & Accommodation:**
     - rooms
     - reservations
     - guests
     
     **Billing:**
     - invoices
     - invoice_items
     
     **Services & Tasks:**
     - services
     - service_requests
     - tasks
     
     **Reports:**
     - reports
     
     **Staff Management:**
     - staff
     - staff_schedules
     - time_entries
     - training_modules
     - staff_trainings
     - performance_metrics
     - staff_leaves
     
     **Inventory:**
     - inventory_categories
     - inventory_items
     - inventory_transactions
     - inventory_suppliers
     - inventory_purchase_orders
     - inventory_purchase_order_items
     
     **Restaurant:**
     - restaurant_categories
     - restaurant_menu_items
     - restaurant_orders
     - restaurant_order_items
     - restaurant_tables
     - restaurant_reservations

### Option 2: Using Supabase CLI

If you have Supabase CLI installed, you can run:

```bash
supabase db reset
```

Then apply the migration:

```bash
supabase db push
```

## What the Scripts Create

### 1. Core Tables
- **access_requests**: User access request management
- **permissions**: System permissions
- **user_profiles**: User profile information
- **user_permissions**: User-permission relationships

### 2. Booking & Accommodation
- **rooms**: Hotel room information (9 rooms pre-populated)
- **reservations**: Room reservations
- **guests**: Guest information

### 3. Billing
- **invoices**: Invoice records
- **invoice_items**: Invoice line items

### 4. Services & Tasks
- **services**: Available hotel services
- **service_requests**: Guest service requests
- **tasks**: Housekeeping and maintenance tasks

### 5. Reports
- **reports**: Generated report storage

### 6. Staff Management (NEW)
- **staff**: Staff member information (5 sample staff pre-populated)
- **staff_schedules**: Staff work schedules and shifts
- **time_entries**: Clock in/out records
- **training_modules**: Training courses and materials
- **staff_trainings**: Staff training enrollment and completion
- **performance_metrics**: Staff performance reviews
- **staff_leaves**: Leave requests and approvals

### 7. Inventory Management
- **inventory_categories**: Inventory categories
- **inventory_items**: Inventory items
- **inventory_transactions**: Inventory transactions
- **inventory_suppliers**: Supplier information
- **inventory_purchase_orders**: Purchase orders
- **inventory_purchase_order_items**: Purchase order items

### 8. Restaurant Module
- **restaurant_categories**: Menu categories
- **restaurant_menu_items**: Menu items
- **restaurant_orders**: Restaurant orders
- **restaurant_order_items**: Order items
- **restaurant_tables**: Restaurant tables
- **restaurant_reservations**: Table reservations

## Initial Data

The scripts automatically create:

### From complete_supabase_setup.sql:
- **7 Default Permissions** (manage_reservations, manage_rooms, etc.)
- **9 Hotel Rooms**:
  - 3 Standard rooms (Mint, Cinnamon, Basil) - 500 GHS
  - 5 Superior rooms (Licorice, Marigold, Lotus, Jasmine, Private) - 750 GHS
  - 1 Executive room (Chamomile) - 1,250 GHS

### From staff_tables_setup.sql:
- **5 Sample Staff Members**:
  - John Doe - Hotel Manager (Management) - 8,000 GHS
  - Jane Smith - Receptionist (Front Desk) - 3,500 GHS
  - Michael Johnson - Housekeeping Manager (Housekeeping) - 4,500 GHS
  - Sarah Williams - Chef (Food & Beverage) - 5,000 GHS
  - David Brown - Maintenance Supervisor (Maintenance) - 4,000 GHS

## Security

All tables have Row Level Security (RLS) enabled with appropriate policies:
- Authenticated users can access most data
- Admin/Manager roles have elevated permissions
- Guest data is protected appropriately

## Troubleshooting

### If you get policy conflicts:
Some policies may already exist. You can ignore "already exists" errors.

### If you need to reset:
```sql
-- Drop all tables (CAUTION: This deletes all data!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run the complete_supabase_setup.sql script
```

### Check table creation:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Next Steps

After successful setup:
1. ✅ Tables are created
2. ✅ RLS policies are in place
3. ✅ Initial room data is populated
4. Deploy your app to Vercel (already done)
5. Test the application functionality

## Support

If you encounter any issues:
1. Check the Supabase SQL Editor for error messages
2. Verify your project credentials are correct
3. Ensure you have necessary permissions on the Supabase project

---

**Last Updated**: 2025-11-03
**Project**: Lavimac Hotel Management System
