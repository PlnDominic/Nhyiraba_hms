-- Staff leaving and rejoining.
-- Deleting a staff row cascades to staff_schedules and time_entries, so a leaver's
-- attendance history disappears with them. Leavers are instead marked 'Left' with a
-- last working day and reason, and their login is switched off in Supabase Auth
-- (banned_until), which blocks sign-in and token refresh at the server.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS leaving_reason TEXT,
  ADD COLUMN IF NOT EXISTS leaving_notes TEXT,
  ADD COLUMN IF NOT EXISTS login_disabled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_staff_end_date ON public.staff(end_date);

-- Allow the 'Left' status. The rule is only re-added when every existing row already
-- satisfies it, so rows with older spellings never become impossible to edit.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.staff'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.staff DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE status IS NOT NULL
      AND status NOT IN ('Active', 'Inactive', 'On Leave', 'Terminated', 'Left')
  ) THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_status_check
      CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Terminated', 'Left'));
  ELSE
    RAISE NOTICE 'staff.status has non-standard values; status check constraint not re-added';
  END IF;
END $$;

-- Who may record departures: the roles that can open the Staff page.
CREATE OR REPLACE FUNCTION public.app_can_manage_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('admin', 'administrator', 'manager', 'hr'), false);
$$;

-- The staff row's linked account, else the account with the same email.
CREATE OR REPLACE FUNCTION public.staff_login_user_id(p_staff public.staff)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    p_staff.user_id,
    (SELECT u.id FROM auth.users u
     WHERE p_staff.email IS NOT NULL AND lower(u.email) = lower(btrim(p_staff.email))
     LIMIT 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- Record that a staff member has left.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offboard_staff_member(
  p_staff_id UUID,
  p_end_date DATE,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_disable_login BOOLEAN DEFAULT true
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff public.staff%ROWTYPE;
  v_user_id UUID;
  v_login_disabled BOOLEAN := false;
  v_cancelled INTEGER := 0;
BEGIN
  IF NOT public.app_can_manage_staff() THEN
    RAISE EXCEPTION 'Only managers, HR or administrators can record a staff departure' USING ERRCODE = '42501';
  END IF;
  IF p_end_date IS NULL THEN
    RAISE EXCEPTION 'Last working day is required' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason for leaving is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found' USING ERRCODE = 'P0002';
  END IF;

  v_user_id := public.staff_login_user_id(v_staff);

  IF v_user_id IS NOT NULL AND v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot record your own departure' USING ERRCODE = '42501';
  END IF;

  IF p_disable_login AND v_user_id IS NOT NULL THEN
    IF NOT public.app_is_admin() AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = v_user_id AND role IN ('admin', 'administrator')
    ) THEN
      RAISE EXCEPTION 'Only an administrator can disable an administrator''s login' USING ERRCODE = '42501';
    END IF;

    -- Same effect as the Auth admin API's ban_duration: sign-in and refresh are refused.
    UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = v_user_id;

    -- End their open sessions so tokens cannot be refreshed (refresh tokens cascade).
    BEGIN
      DELETE FROM auth.sessions WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not end sessions for %: %', v_user_id, SQLERRM;
    END;

    v_login_disabled := true;
  END IF;

  -- Shifts after the last working day would show as covered when they are not.
  IF to_regclass('public.staff_schedules') IS NOT NULL THEN
    UPDATE public.staff_schedules
    SET status = 'cancelled'
    WHERE staff_id = p_staff_id AND shift_date > p_end_date AND status = 'scheduled';
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  UPDATE public.staff
  SET status = 'Left',
      end_date = p_end_date,
      leaving_reason = btrim(p_reason),
      leaving_notes = nullif(btrim(coalesce(p_notes, '')), ''),
      user_id = coalesce(user_id, v_user_id),
      login_disabled_at = CASE WHEN v_login_disabled THEN now() ELSE login_disabled_at END
  WHERE id = p_staff_id;

  RETURN jsonb_build_object(
    'has_login', v_user_id IS NOT NULL,
    'login_disabled', v_login_disabled,
    'cancelled_shifts', v_cancelled
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Bring a former staff member back (rehire, or a departure recorded by mistake).
-- Admin-only: it re-opens a login.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reinstate_staff_member(
  p_staff_id UUID,
  p_enable_login BOOLEAN DEFAULT true
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff public.staff%ROWTYPE;
  v_user_id UUID;
  v_login_enabled BOOLEAN := false;
BEGIN
  IF NOT public.app_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can reinstate a former staff member' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found' USING ERRCODE = 'P0002';
  END IF;

  v_user_id := public.staff_login_user_id(v_staff);

  IF p_enable_login AND v_user_id IS NOT NULL THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = v_user_id;
    v_login_enabled := true;
  END IF;

  UPDATE public.staff
  SET status = 'Active',
      end_date = NULL,
      leaving_reason = NULL,
      leaving_notes = NULL,
      user_id = coalesce(user_id, v_user_id),
      login_disabled_at = CASE WHEN v_login_enabled THEN NULL ELSE login_disabled_at END
  WHERE id = p_staff_id;

  RETURN jsonb_build_object(
    'has_login', v_user_id IS NOT NULL,
    'login_enabled', v_login_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.app_can_manage_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_login_user_id(public.staff) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offboard_staff_member(UUID, DATE, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reinstate_staff_member(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_manage_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.offboard_staff_member(UUID, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reinstate_staff_member(UUID, BOOLEAN) TO authenticated;
