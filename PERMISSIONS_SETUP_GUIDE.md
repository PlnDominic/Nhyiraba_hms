# Permissions Setup Guide

## Current Issue
The Access Control page doesn't show permissions for:
- Restaurant/Bar management
- Services management  
- Inventory management
- Tasks management

## Solution

### Step 1: Add Missing Permissions to Database

Run the SQL script `add_missing_permissions.sql` in Supabase SQL Editor:

```sql
INSERT INTO permissions (name, description) VALUES
    ('manage_restaurant', 'Access and manage restaurant/bar operations'),
    ('view_restaurant', 'View restaurant orders and menu'),
    ('manage_services', 'Manage hotel services and service requests'),
    ('view_services', 'View service requests and status'),
    ('manage_inventory', 'Manage inventory items and stock levels'),
    ('view_inventory', 'View inventory and stock information'),
    ('manage_tasks', 'Create and manage tasks'),
    ('view_tasks', 'View assigned tasks')
ON CONFLICT (name) DO NOTHING;
```

### Step 2: Verify Permissions

After running the script, verify in Supabase:

```sql
SELECT id, name, description 
FROM permissions 
ORDER BY name;
```

You should now see 15 permissions total:
1. manage_billing
2. manage_guests
3. manage_inventory ✨ NEW
4. manage_reservations
5. manage_restaurant ✨ NEW
6. manage_rooms
7. manage_services ✨ NEW
8. manage_staff
9. manage_tasks ✨ NEW
10. system_settings
11. view_inventory ✨ NEW
12. view_reports
13. view_restaurant ✨ NEW
14. view_services ✨ NEW
15. view_tasks ✨ NEW

### Step 3: Refresh Access Control Page

1. Go to your app's Access Control page
2. Select a pending access request
3. Scroll to the **Permissions** section
4. You should now see the new permissions! ✅

---

## Permission Descriptions

### Restaurant/Bar Permissions
- **manage_restaurant**: Full access to restaurant module (orders, menu, tables)
- **view_restaurant**: Read-only access to restaurant orders

**Who needs it**: Food & Beverage staff, Management

### Services Permissions
- **manage_services**: Create/edit/delete service requests
- **view_services**: View service requests only

**Who needs it**: Front Desk, Housekeeping, Maintenance, Management

### Inventory Permissions
- **manage_inventory**: Manage stock levels, add/remove items
- **view_inventory**: View inventory status only

**Who needs it**: Housekeeping, Food & Beverage, Management

### Tasks Permissions
- **manage_tasks**: Create and assign tasks
- **view_tasks**: View assigned tasks

**Who needs it**: All departments

---

## Department-Based Access (Already Configured)

Even without explicit permissions, users have department-based page access:

| Department | Pages Accessible |
|------------|------------------|
| Front Desk | Dashboard, Reservations, Rooms, Guests, Tasks, Billing, Services |
| Housekeeping | Dashboard, Tasks, Rooms, Services |
| Food & Beverage | Dashboard, Tasks, **Restaurant**, Services, **Inventory** |
| Management | All pages |
| Maintenance | Dashboard, Tasks, Services |
| Accounting | Dashboard, Billing, Reports |
| HR | Dashboard, Staff, Reports, Staff Access |

**Note**: Page access is granted by department. Permissions provide fine-grained control within those pages.

---

## Recommended Permission Sets

### Food & Beverage Staff
```
✅ manage_restaurant
✅ view_restaurant  
✅ manage_inventory
✅ view_inventory
✅ view_tasks
✅ manage_services
```

### Housekeeping Staff
```
✅ manage_tasks
✅ view_tasks
✅ manage_services
✅ view_services
✅ view_inventory
```

### Front Desk Staff
```
✅ manage_reservations
✅ manage_rooms
✅ manage_guests
✅ manage_billing
✅ manage_services
✅ view_services
✅ manage_tasks
```

### Maintenance Staff
```
✅ manage_services
✅ view_services
✅ manage_tasks
✅ view_tasks
```

---

## Testing

After adding permissions:

1. **Create a new user** in Access Control
2. **Assign permissions** for Restaurant, Services, or Inventory
3. **Log in as that user**
4. **Verify they can access** the appropriate pages

---

## Troubleshooting

### Permissions not showing in dropdown
- ✅ Run the SQL script in Supabase
- ✅ Refresh the Access Control page
- ✅ Check browser console for errors

### User can't access page even with permission
- ✅ Check their **department** allows page access (see table above)
- ✅ Verify permission was saved (check user_permissions table)
- ✅ Log out and log back in to refresh session

### Permission saved but not working
- Check RLS policies allow the operation
- Verify the component checks for the correct permission name

---

## Files Modified

- `add_missing_permissions.sql` - SQL script to add permissions
- This guide - Documentation

**Last Updated**: 2025-11-09
