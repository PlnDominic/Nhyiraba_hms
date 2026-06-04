# Department Access Update

## Changes Made

Updated department-based page access to align with assignable permissions.

### Before vs After

| Department | Added Pages |
|------------|-------------|
| Food Beverage | + Settings |
| Housekeeping | + Inventory, (Settings already had) |

---

## Current Department Access Matrix

### Front Desk
- ✅ Dashboard
- ✅ Reservations
- ✅ Rooms
- ✅ Guests
- ✅ Tasks
- ✅ Billing
- ✅ Services
- ✅ Settings

### Housekeeping
- ✅ Dashboard
- ✅ Tasks
- ✅ Rooms
- ✅ Services
- ✅ **Inventory** (NEW)
- ✅ Settings

### Food & Beverage
- ✅ Dashboard
- ✅ Tasks
- ✅ Restaurant
- ✅ Services
- ✅ Inventory
- ✅ **Settings** (NEW)

### Maintenance
- ✅ Dashboard
- ✅ Tasks
- ✅ Services
- ✅ Settings

### Accounting
- ✅ Dashboard
- ✅ Billing
- ✅ Reports
- ✅ Settings

### HR (Human Resources)
- ✅ Dashboard
- ✅ Staff
- ✅ Reports
- ✅ Settings
- ✅ Staff Access

### Management
- ✅ All pages (unchanged)

---

## How Department Access Works

Department access is the **BASE** level of access. It determines which pages a user can see based on their department.

### Example Flow:

1. User logs in → System checks their department
2. User tries to access "Restaurant" page
3. System checks: Is "Restaurant" in `departmentAccess[user.department]`?
4. If YES → Allow access
5. If NO → Show "Access Denied"

**Note**: Permissions provide fine-grained control WITHIN the pages they can access, but department access controls which pages they can navigate to.

---

## Why Settings Was Added to All Departments

**Settings page** includes:
- User profile settings
- Password change
- Personal preferences
- App settings

**All staff need access to Settings** to:
- Update their profile
- Change their password
- Customize their experience

This is why it's now included in all department access lists.

---

## Testing

After this update, verify:

1. ✅ Food & Beverage staff can access Settings page
2. ✅ Housekeeping staff can access Inventory page  
3. ✅ All departments can access their Settings

Test users with explicit permissions to ensure they work:
- Food & Beverage with `manage_restaurant` can manage restaurant
- Housekeeping with `manage_inventory` can manage inventory

---

## Related Files

- `client/src/hooks/usePermission.js` - Department access configuration
- `client/src/components/ProtectedRoute.js` - Access enforcement

---

**Last Updated**: 2025-11-09
