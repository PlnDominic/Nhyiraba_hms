# Inventory Request Feature Setup Guide

## Overview
This feature allows housekeeping staff to request inventory items through the Tasks page. Requests are tracked and can be approved/fulfilled by managers and administrators.

## Features Implemented

### 1. Housekeeping Staff Features
- **View Current Stock**: See all housekeeping department inventory with stock levels
- **Request Items**: Create inventory requests with multiple items and quantities
- **Track Requests**: View all submitted requests with status updates
- **Room Access**: View room statuses (Occupied, Reserved, Available, Cleaning)

### 2. Request Management
- **Status Workflow**: pending → approved → fulfilled (or rejected)
- **Request History**: Complete audit trail of all requests
- **Item Details**: Track requested, approved, and fulfilled quantities
- **Notes**: Add context and special instructions to requests

## Database Setup

### Step 1: Run SQL Migration
1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `inventory_requests_migration.sql`
4. Paste and run the SQL script
5. Verify tables are created:
   - `inventory_requests`
   - `inventory_request_items`

### Step 2: Verify RLS Policies
The migration automatically creates Row Level Security policies:
- Users can view their department's requests
- Users can create requests for their department
- Admins and managers can view/update all requests

## How to Use

### For Housekeeping Staff

#### Viewing Inventory
1. Navigate to **Tasks** page
2. Click on **Housekeeping Inventory** tab
3. View current stock levels in the **Current Stock** sub-tab

#### Creating a Request
1. In the Housekeeping Inventory tab, click **Request Items** button
2. Search for items in the left column
3. Click on items to add them to your request
4. Adjust quantities using +/- buttons
5. Add optional notes
6. Click **Submit Request**

#### Tracking Requests
1. Go to **My Requests** sub-tab
2. View all your submitted requests
3. Check status: PENDING, APPROVED, FULFILLED, or REJECTED
4. See detailed item lists and notes

#### Viewing Room Status
1. Navigate to **Rooms** page from the sidebar
2. View all rooms with their current status:
   - **Available**: Green - Ready for guests
   - **Occupied**: Blue - Currently has guests
   - **Reserved**: Yellow - Booked for future
   - **Cleaning**: Purple - Being cleaned
3. See guest names for occupied rooms
4. Use this information to prioritize cleaning tasks

### For Managers/Administrators

#### Viewing Requests (To be implemented)
1. Navigate to **Inventory** page
2. View pending requests from all departments
3. Review requested items and quantities
4. Approve or reject requests
5. Mark requests as fulfilled when items are distributed

## Request Status Meanings

| Status | Color | Description |
|--------|-------|-------------|
| **PENDING** | Amber/Yellow | Request submitted, waiting for approval |
| **APPROVED** | Green | Request approved, waiting for fulfillment |
| **FULFILLED** | Blue | Items distributed, request complete |
| **REJECTED** | Red | Request denied |

## Technical Details

### Database Schema

#### inventory_requests
```sql
- id: UUID (Primary Key)
- requested_by: UUID (User ID)
- requester_name: TEXT
- department: TEXT
- status: TEXT (pending/approved/fulfilled/rejected)
- notes: TEXT
- approved_by: UUID
- approved_at: TIMESTAMP
- fulfilled_by: UUID
- fulfilled_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### inventory_request_items
```sql
- id: UUID (Primary Key)
- request_id: UUID (Foreign Key)
- item_id: UUID (Foreign Key to inventory_items)
- item_name: TEXT
- quantity_requested: NUMERIC
- quantity_approved: NUMERIC
- quantity_fulfilled: NUMERIC
- unit_of_measure: TEXT
- created_at: TIMESTAMP
```

### Components

1. **TasksPage.js**
   - Main page with tabs for Tasks and Inventory
   - HousekeepingInventoryView component with sub-tabs
   - Request list and stock display

2. **InventoryRequestModal.js**
   - Modal for creating new requests
   - Two-column layout (available items / selected items)
   - Search and quantity controls

## Future Enhancements

### Planned Features
1. **Admin Request Management Interface**
   - View all pending requests
   - Approve/reject requests
   - Mark requests as fulfilled
   - Add approval notes

2. **Notifications**
   - Email notifications for status changes
   - In-app notifications for approvals/rejections

3. **Analytics**
   - Request frequency reports
   - Most requested items
   - Department usage statistics

4. **Inventory Integration**
   - Auto-deduct stock when fulfilled
   - Low stock alerts
   - Reorder suggestions based on requests

## Troubleshooting

### Common Issues

**Issue**: Cannot see inventory items
- **Solution**: Ensure items are assigned to "Housekeeping" department in inventory

**Issue**: Request submission fails
- **Solution**: Verify database tables are created and RLS policies are active

**Issue**: Cannot access Rooms page
- **Solution**: Check user role and permissions in Sidebar.js

**Issue**: Requests not showing
- **Solution**: Verify user's department matches request department

## Support

For issues or questions:
1. Check the console for error messages
2. Verify database tables and RLS policies
3. Ensure user has correct department assignment
4. Contact system administrator

## Version History

- **v1.0** (Current)
  - Initial implementation
  - Basic request creation and tracking
  - Housekeeping inventory view
  - Room status access for housekeeping staff
