# Room Prices Update Guide

This guide will help you update all room prices from the Excel file and add block/building information to your rooms.

## Overview

- **Total Rooms**: 42 rooms
- **Main Block**: 28 rooms (prices: GHS 150 - 300)
- **Aquarian Block**: 14 rooms (prices: GHS 500)

## Step 1: Add Block Column to Database

You need to run the following SQL in your **Supabase SQL Editor**:

1. Go to: https://supabase.com/dashboard/project/bviglsgfbwjhioeyhnin/sql
2. Click "New Query"
3. Copy and paste the SQL below:

```sql
-- Add block/building column to rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS block VARCHAR(100) DEFAULT 'Main Block';

-- Create index on block column for better query performance
CREATE INDEX IF NOT EXISTS idx_rooms_block ON public.rooms(block);

-- Add comment to document the column
COMMENT ON COLUMN public.rooms.block IS 'Building/Block where the room is located (e.g., Main Block, Aquarian Block)';
```

4. Click "Run" to execute the SQL
5. You should see: "Success. No rows returned"

## Step 2: Update Room Prices from Excel

After Step 1 is complete, run this command in your terminal:

```bash
node update_room_prices_from_excel.js
```

This will:
- ✅ Update prices for all 42 rooms
- ✅ Assign correct blocks (Main Block / Aquarian Block)
- ✅ Create any missing rooms
- ✅ Show a summary of all changes

## Step 3: Verify Updates

After the script completes, you'll see a summary like:

```
✓ Rooms Updated: XX
✓ Rooms Created: XX
✗ Errors: 0
```

## Price Distribution

### Main Block (28 rooms)
- **GHS 300**: 12 rooms (R-001 to R-012)
- **GHS 270**: 1 room (R-013)
- **GHS 250**: 3 rooms (R-014 to R-016)
- **GHS 170**: 10 rooms (R-017 to R-026)
- **GHS 150**: 2 rooms (R-027, R-028)

### Aquarian Block (14 rooms)
- **GHS 500**: 14 rooms (R-001 to R-014)

## Component Updates

The following components have been updated to display block information:

1. **RoomCard Component** - Now shows building/block for each room
2. **RoomsPage** - Displays rooms grouped by block with filters
3. **Dashboard** - Shows room statistics per block

## Troubleshooting

### Error: "Could not find the 'block' column"
- Make sure you completed **Step 1** first
- Verify the SQL ran successfully in Supabase
- Try refreshing your Supabase dashboard

### Error: "Permission denied"
- Make sure your Supabase credentials are correct
- Check that the service key has proper permissions

## Next Steps

After completing the updates:
1. ✅ Refresh your application
2. ✅ Check the Rooms page to see block information
3. ✅ Verify all prices are correct
4. ✅ Test room reservations with new pricing

---

**Need help?** Contact your system administrator.
