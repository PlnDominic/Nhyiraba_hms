# Quick Setup Guide - Lavimac HMS Database

## 🚀 Quick Start (2 Scripts to Run)

### What You Need
- Access to Supabase Dashboard: https://supabase.com/dashboard
- Your project: `kqjoqkmcxvynqdsjekkc`

### Step-by-Step

1. **Go to Supabase SQL Editor**
   - Open https://supabase.com/dashboard
   - Select project `kqjoqkmcxvynqdsjekkc`
   - Click "SQL Editor" in sidebar

2. **Run Script #1: Main Database Setup**
   ```
   File: complete_supabase_setup.sql
   Action: Copy all → Paste in SQL Editor → Click "Run"
   Wait: ~30 seconds
   ```
   
   ✅ Creates: 26 core tables (rooms, guests, invoices, inventory, restaurant, etc.)

3. **Run Script #2: Staff Tables**
   ```
   File: staff_tables_setup.sql
   Action: Click "New Query" → Copy all → Paste → Click "Run"
   Wait: ~10 seconds
   ```
   
   ✅ Creates: 8 staff tables + 5 sample staff members

4. **Verify**
   - Click "Table Editor" in sidebar
   - You should see 34 total tables

## 📊 What Gets Created

| Category | Tables | Sample Data |
|----------|--------|-------------|
| **Core** | 4 tables | 7 permissions |
| **Rooms & Guests** | 3 tables | 9 hotel rooms |
| **Billing** | 2 tables | - |
| **Services** | 3 tables | - |
| **Staff** | 8 tables | 5 staff members |
| **Inventory** | 6 tables | - |
| **Restaurant** | 6 tables | - |
| **Reports** | 1 table | - |
| **TOTAL** | **34 tables** | Ready to use! |

## 🏨 Sample Hotel Rooms Created

| Room | Type | Price (GHS) |
|------|------|-------------|
| Mint, Cinnamon, Basil | Standard | 500 |
| Licorice, Marigold, Lotus, Jasmine, Private | Superior | 750 |
| Chamomile | Executive | 1,250 |

## 👥 Sample Staff Members Created

| Name | Position | Department | Salary (GHS) |
|------|----------|------------|--------------|
| John Doe | Hotel Manager | Management | 8,000 |
| Jane Smith | Receptionist | Front Desk | 3,500 |
| Michael Johnson | Housekeeping Manager | Housekeeping | 4,500 |
| Sarah Williams | Chef | Food & Beverage | 5,000 |
| David Brown | Maintenance Supervisor | Maintenance | 4,000 |

## ⚠️ Troubleshooting

### "Policy already exists" error
- This is normal, ignore it - the script checks for existing policies

### "Table already exists" error
- Tables won't be recreated if they exist
- To start fresh, drop tables manually first (see main instructions)

### Script runs but app still shows 404 errors
1. Check you ran BOTH scripts
2. Verify tables exist in "Table Editor"
3. Clear browser cache and reload app
4. Check environment variables are set in Vercel

## 🔗 Next Steps

After running both scripts:

1. ✅ Database is ready
2. ✅ Sample data is loaded
3. 🔄 Redeploy app to Vercel (if needed): `vercel deploy --prod`
4. 🌐 Test your app: https://nhyiraba-ehbv4s0oe-dkudoms-projects.vercel.app

## 📝 Files Reference

| File | Purpose |
|------|---------|
| `complete_supabase_setup.sql` | Main database setup (26 tables) |
| `staff_tables_setup.sql` | Staff management tables (8 tables) |
| `SUPABASE_SETUP_INSTRUCTIONS.md` | Detailed instructions |
| `QUICK_SETUP_GUIDE.md` | This file - quick reference |

---

**Need help?** Check `SUPABASE_SETUP_INSTRUCTIONS.md` for detailed troubleshooting.
