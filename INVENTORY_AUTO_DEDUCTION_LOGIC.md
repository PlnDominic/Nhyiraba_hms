# Automatic Inventory Deduction System

## ✅ Changes Implemented

### Removed from Menu Item Modal:
- ❌ "Inventory Linking (Optional)" section
- ❌ "Linked Inventory Item" dropdown
- ❌ "Quantity to Deduct" field
- ❌ Manual inventory item linking

---

## 🔄 New Automatic Inventory Deduction Logic

### How It Works:

```
┌─────────────────────────────────────────────────────────────┐
│                  INVENTORY FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. STOCK TRANSFER                                          │
│     Main Inventory → Bar Location                           │
│     ├─ VIP pub                                              │
│     ├─ Entrance Pub / Reception                             │
│     ├─ Poolside Pub                                         │
│     └─ Pizza Palace                                         │
│                                                             │
│  2. ORDER PLACED                                            │
│     Customer orders at specific location                    │
│     Example: "Chicken Wings" at VIP pub                    │
│                                                             │
│  3. AUTOMATIC DEDUCTION                                     │
│     System automatically deducts from:                      │
│     → VIP pub's inventory stock                             │
│     → No manual linking needed                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Details

### Current System (Already in Place):

The system already has automatic inventory deduction in `OrderModal.js`:

```javascript
// Process Stock Deduction
if (activeBar) {
  const stockUsageData = [];
  formData.items.forEach(item => {
    if (item.menu_item && item.menu_item.inventory_item_id) {
      const qtyNeeded = item.menu_item.inventory_quantity_needed || 1;
      const totalDeduct = qtyNeeded * item.quantity;

      stockUsageData.push({
        inventory_item_id: item.menu_item.inventory_item_id,
        quantity: totalDeduct,
        department_name: activeBar,
        reference: `Order #${orderId.substring(0, 8)}`
      });
    }
  });

  if (stockUsageData.length > 0) {
    await processStockUsage(stockUsageData);
  }
}
```

### What Changed:

**Before:**
- Staff manually linked menu items to inventory items
- Staff set quantity to deduct per order
- Complex setup process

**After:**
- No manual linking in menu item creation
- System uses location-based inventory
- Automatic deduction based on stock transfers

---

## 🎯 Location-Based Inventory System

### Inventory Structure:

```
Main Inventory (Central Store)
│
├─ VIP pub
│  ├─ Beer (50 bottles)
│  ├─ Wine (30 bottles)
│  └─ Snacks (100 packs)
│
├─ Entrance Pub / Reception
│  ├─ Soft Drinks (200 cans)
│  ├─ Water (150 bottles)
│  └─ Chips (80 packs)
│
├─ Poolside Pub
│  ├─ Cocktails (40 servings)
│  ├─ Juice (60 bottles)
│  └─ Fruit Platters (20 servings)
│
├─ Pizza Palace
│  ├─ Pizza Dough (50 units)
│  ├─ Cheese (30 kg)
│  └─ Toppings (Various)
│
├─ Housekeeping
│  ├─ Towels (200 units)
│  ├─ Toiletries (500 units)
│  └─ Cleaning Supplies (Various)
│
└─ Supermarket
   ├─ Groceries (Various)
   ├─ Beverages (Various)
   └─ Household Items (Various)
```

---

## 🔧 How Automatic Deduction Works

### Example Scenario:

**Step 1: Stock Transfer**
```
Transfer: 50 bottles of "Heineken Beer"
From: Main Inventory
To: VIP pub
Status: Completed
```

**Step 2: Order Placed**
```
Order: 3x Heineken Beer
Location: VIP pub
Customer: Room 305
```

**Step 3: Automatic Deduction**
```
System automatically:
1. Identifies order location: VIP pub
2. Finds inventory at VIP pub
3. Deducts 3 bottles from VIP pub stock
4. Updates inventory: 50 → 47 bottles
5. Records transaction reference
```

---

## 📊 Database Schema

### Menu Items Table:
```sql
restaurant_menu_items
├─ id
├─ name
├─ description
├─ price
├─ preparation_time
├─ is_available
├─ bar_location          -- Location where item is sold
└─ created_at
```

**Removed Fields:**
- ~~inventory_item_id~~ (No longer needed)
- ~~inventory_quantity_needed~~ (No longer needed)

### Department Stock Table:
```sql
department_stock
├─ id
├─ inventory_item_id     -- Links to inventory_items
├─ department_name       -- VIP pub, Poolside Pub, etc.
├─ current_stock         -- Current quantity at location
├─ last_updated
└─ created_at
```

### Stock Usage Table:
```sql
stock_usage
├─ id
├─ inventory_item_id
├─ quantity              -- Amount deducted
├─ department_name       -- Where it was used
├─ reference             -- Order reference
├─ usage_date
└─ created_at
```

---

## 🎯 Benefits of Automatic System

### 1. **Simplified Menu Management**
- ✅ No manual inventory linking
- ✅ Faster menu item creation
- ✅ Less training required
- ✅ Fewer errors

### 2. **Location-Based Accuracy**
- ✅ Deducts from correct location
- ✅ Prevents stock discrepancies
- ✅ Better inventory tracking
- ✅ Real-time stock levels

### 3. **Operational Efficiency**
- ✅ Automatic stock deduction
- ✅ No manual calculations
- ✅ Instant inventory updates
- ✅ Accurate reporting

### 4. **Better Stock Control**
- ✅ Track usage by location
- ✅ Identify high-demand items
- ✅ Optimize stock transfers
- ✅ Reduce wastage

---

## 🔄 Stock Transfer Process

### How to Transfer Stock:

**Step 1: Initiate Transfer**
```
Navigate to: Inventory → Transfer Stock
Select: Item to transfer
From: Main Inventory
To: VIP pub (or other location)
Quantity: 50 units
```

**Step 2: Approve Transfer**
```
Manager approves transfer
Stock moves from Main → VIP pub
System updates both locations
```

**Step 3: Automatic Tracking**
```
VIP pub stock: +50 units
Main Inventory: -50 units
Transfer recorded in history
```

---

## 📈 Inventory Tracking by Location

### Real-Time Stock Levels:

```
┌─────────────────────────────────────────────────────────┐
│  VIP PUB INVENTORY                                      │
├─────────────────────────────────────────────────────────┤
│  Item              Current Stock    Reorder Level       │
│  ─────────────────────────────────────────────────────  │
│  Heineken Beer          47              20              │
│  Red Wine               28              15              │
│  Chicken Wings          35              25              │
│  Chips                  82              30              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  POOLSIDE PUB INVENTORY                                 │
├─────────────────────────────────────────────────────────┤
│  Item              Current Stock    Reorder Level       │
│  ─────────────────────────────────────────────────────  │
│  Mojito Mix             38              20              │
│  Fresh Juice            55              30              │
│  Fruit Platter          18              10              │
│  Ice Cream              42              25              │
└─────────────────────────────────────────────────────────┘
```

---

## 🚨 Low Stock Alerts

### Automatic Notifications:

When stock at any location falls below reorder level:

```
🔔 Low Stock Alert
─────────────────
Location: VIP pub
Item: Heineken Beer
Current: 18 bottles
Reorder Level: 20 bottles
Action: Transfer stock or reorder
```

---

## 📊 Usage Reports

### Track Consumption by Location:

```
┌─────────────────────────────────────────────────────────┐
│  DAILY USAGE REPORT - VIP PUB                           │
├─────────────────────────────────────────────────────────┤
│  Date: 2025-11-29                                       │
│                                                         │
│  Item              Sold    Deducted    Remaining        │
│  ─────────────────────────────────────────────────────  │
│  Heineken Beer      12        12          35            │
│  Red Wine            8         8          20            │
│  Chicken Wings      15        15          20            │
│  Chips              18        18          64            │
│                                                         │
│  Total Orders: 42                                       │
│  Total Revenue: GH₵2,450                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Inventory Context (InventoryContext.js):

The `processStockUsage` function handles automatic deduction:

```javascript
const processStockUsage = async (stockUsageData) => {
  try {
    for (const usage of stockUsageData) {
      // Deduct from department stock
      await supabase.rpc('deduct_department_stock', {
        p_inventory_item_id: usage.inventory_item_id,
        p_department_name: usage.department_name,
        p_quantity: usage.quantity,
        p_reference: usage.reference
      });
    }
    return true;
  } catch (error) {
    console.error('Error processing stock usage:', error);
    throw error;
  }
};
```

### Database Function:

```sql
CREATE OR REPLACE FUNCTION deduct_department_stock(
  p_inventory_item_id UUID,
  p_department_name TEXT,
  p_quantity NUMERIC,
  p_reference TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update department stock
  UPDATE department_stock
  SET 
    current_stock = current_stock - p_quantity,
    last_updated = NOW()
  WHERE 
    inventory_item_id = p_inventory_item_id
    AND department_name = p_department_name;
  
  -- Record usage
  INSERT INTO stock_usage (
    inventory_item_id,
    quantity,
    department_name,
    reference,
    usage_date
  ) VALUES (
    p_inventory_item_id,
    p_quantity,
    p_department_name,
    p_reference,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Migration Notes

### For Existing Menu Items:

If you have existing menu items with `inventory_item_id` and `inventory_quantity_needed`:

**Option 1: Keep Data (Recommended)**
- Leave existing data in database
- System will continue to use it for automatic deduction
- New items won't have these fields

**Option 2: Clean Up**
- Run migration to remove old fields
- Update database schema
- Rely purely on location-based inventory

---

## 🎯 Best Practices

### 1. **Regular Stock Transfers**
- Transfer stock based on demand
- Monitor consumption patterns
- Maintain optimal stock levels

### 2. **Location-Specific Inventory**
- Keep popular items at each location
- Avoid overstocking
- Reduce transfer frequency

### 3. **Stock Audits**
- Regular physical counts
- Reconcile with system records
- Identify discrepancies

### 4. **Reorder Levels**
- Set appropriate reorder points
- Consider lead times
- Account for peak periods

---

## 📝 Summary

**What Was Removed:**
- Manual inventory linking in menu item modal
- Inventory item dropdown
- Quantity to deduct field

**What Stays:**
- Automatic inventory deduction (already working)
- Location-based stock management
- Stock transfer system
- Usage tracking and reporting

**Result:**
- ✅ Simpler menu item creation
- ✅ Automatic inventory management
- ✅ Location-based accuracy
- ✅ Better operational efficiency

---

**Document Created**: 2025-11-29  
**Status**: ✅ Inventory Linking Removed  
**System**: Automatic Deduction Active
