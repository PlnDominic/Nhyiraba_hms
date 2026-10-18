-- Operations phase 2: race-safe availability (#1), waitlist (#4), housekeeping (#6),
-- check-in validation records (#7) and check-out settlement (#8).

-- ---------------------------------------------------------------------------
-- #1 Database-level overlap protection
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_overlap') THEN
    RETURN;
  END IF;

  -- Existing double-bookings would make the constraint fail; report instead of aborting.
  IF EXISTS (
    SELECT 1
    FROM public.reservations a
    JOIN public.reservations b
      ON a.id < b.id
     AND a.room_id = b.room_id
     AND a.status IN ('Reserved', 'Confirmed', 'Checked In')
     AND b.status IN ('Reserved', 'Confirmed', 'Checked In')
     AND tstzrange(a.check_in_date, a.check_out_date, '[)') && tstzrange(b.check_in_date, b.check_out_date, '[)')
  ) THEN
    RAISE NOTICE 'reservations_no_overlap NOT created: overlapping active reservations exist. Resolve them (see query in this migration) and re-run.';
  ELSE
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(check_in_date, check_out_date, '[)') WITH &&
      ) WHERE (status IN ('Reserved', 'Confirmed', 'Checked In'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- #6 Housekeeping lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS housekeeping_status VARCHAR(30) NOT NULL DEFAULT 'Clean',
  ADD COLUMN IF NOT EXISTS housekeeping_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS housekeeping_updated_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_housekeeping_status_check') THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT rooms_housekeeping_status_check
      CHECK (housekeeping_status IN ('Clean', 'Dirty', 'Inspected', 'Out of Service'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.housekeeping_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id BIGINT NOT NULL REFERENCES public.rooms(id),
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_housekeeping_log_room ON public.housekeeping_log(room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- #4 Waitlist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  guest_email VARCHAR(255),
  room_type VARCHAR(50),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Converted', 'Cancelled', 'Expired')),
  notes TEXT,
  converted_reservation_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (check_out_date > check_in_date)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_status_priority ON public.waitlist_entries(status, priority, created_at);

-- ---------------------------------------------------------------------------
-- #7 Check-in validation records (reservation rows are removed at check-in,
-- so the validation evidence is kept here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID,
  room_id BIGINT REFERENCES public.rooms(id),
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  guest_email VARCHAR(255),
  id_type VARCHAR(50) NOT NULL,
  id_number VARCHAR(100) NOT NULL,
  deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_confirmed BOOLEAN NOT NULL DEFAULT false,
  policy_acknowledged BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  checked_in_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkin_records_room ON public.checkin_records(room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- #8 Check-out settlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id BIGINT REFERENCES public.rooms(id),
  guest_name VARCHAR(255) NOT NULL,
  check_in_date TIMESTAMP WITH TIME ZONE,
  check_out_date TIMESTAMP WITH TIME ZONE,
  nights INTEGER NOT NULL DEFAULT 1,
  room_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  room_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  late_checkout_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  deposit_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50),
  total_due DECIMAL(10, 2) NOT NULL DEFAULT 0,
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  settled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkout_settlements_room ON public.checkout_settlements(room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS (matches the existing operations tables: authenticated staff)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['housekeeping_log', 'waitlist_entries', 'checkin_records', 'checkout_settlements']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Authenticated users can manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
