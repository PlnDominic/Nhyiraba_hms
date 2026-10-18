-- Authorization tests for 20261022_authorization.sql.
-- Run with scripts/test-db-authorization.sh (throwaway local Postgres with a mock auth schema).
\set ON_ERROR_STOP 1
\set VERBOSITY terse

INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-00000000000a', 'admin@x'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@x'),
  ('00000000-0000-0000-0000-00000000000c', 'mgr@x'),
  ('00000000-0000-0000-0000-00000000000d', 'new@x');
INSERT INTO user_profiles (user_id, full_name, role, department) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin', 'Management'),
  ('00000000-0000-0000-0000-00000000000b', 'Staff', 'staff', 'Front Desk'),
  ('00000000-0000-0000-0000-00000000000c', 'Mgr', 'manager', 'Management');
INSERT INTO invoices (guest_name, room_number, check_in_date, check_out_date) VALUES ('G', '1', 'a', 'b'), ('H', '2', 'a', 'b');
INSERT INTO rooms VALUES (1, 1, 'Std', 'Available', 100, 2);
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE FUNCTION pg_temp.act(u TEXT) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', u, false), set_config('request.jwt.claim.role', 'authenticated', false);
$$;
-- run `sql` as `who`; assert it raises (expect_error) or affects `expect_rows` rows
CREATE FUNCTION pg_temp.check(label TEXT, who TEXT, sql TEXT, expect_rows INT DEFAULT NULL, expect_error BOOLEAN DEFAULT false)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE n INT; failed BOOLEAN := false;
BEGIN
  PERFORM pg_temp.act(who);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE sql;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  EXECUTE 'RESET ROLE';
  IF expect_error AND NOT failed THEN RAISE EXCEPTION 'FAIL %: expected an error', label; END IF;
  IF NOT expect_error AND failed THEN RAISE EXCEPTION 'FAIL %: unexpected error', label; END IF;
  IF expect_rows IS NOT NULL AND NOT failed AND n <> expect_rows THEN RAISE EXCEPTION 'FAIL %: expected % rows, got %', label, expect_rows, n; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set S '''00000000-0000-0000-0000-00000000000b'''
\set M '''00000000-0000-0000-0000-00000000000c'''
\set N '''00000000-0000-0000-0000-00000000000d'''

BEGIN;
SELECT pg_temp.check('staff cannot promote self', :S, $q$UPDATE user_profiles SET role = 'admin' WHERE user_id = auth.uid()$q$, NULL, true);
SELECT pg_temp.check('staff cannot change own department', :S, $q$UPDATE user_profiles SET department = 'Management' WHERE user_id = auth.uid()$q$, NULL, true);
SELECT pg_temp.check('staff can edit own name', :S, $q$UPDATE user_profiles SET full_name = 'Renamed' WHERE user_id = auth.uid()$q$, 1);
SELECT pg_temp.check('staff cannot delete own profile', :S, $q$DELETE FROM user_profiles WHERE user_id = auth.uid()$q$, 0);
SELECT pg_temp.check('staff cannot create profile for others', :S, $q$INSERT INTO user_profiles (user_id, role) VALUES ('00000000-0000-0000-0000-00000000000d', 'admin')$q$, NULL, true);
SELECT pg_temp.check('new user self-insert succeeds', :N, $q$INSERT INTO user_profiles (user_id, full_name, role) VALUES (auth.uid(), 'New', 'admin')$q$, 1);
DO $$ BEGIN
  IF (SELECT role FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-00000000000d') <> 'staff' THEN
    RAISE EXCEPTION 'FAIL self-inserted profile was not forced to staff';
  END IF;
  RAISE NOTICE 'ok  self-inserted profile forced to staff';
END $$;
SELECT pg_temp.check('manager cannot promote self', :M, $q$UPDATE user_profiles SET role = 'admin' WHERE user_id = auth.uid()$q$, NULL, true);
SELECT pg_temp.check('admin can change own department', :A, $q$UPDATE user_profiles SET department = 'Executive' WHERE user_id = auth.uid()$q$, 1);

SELECT pg_temp.check('staff cannot delete invoices', :S, $q$DELETE FROM invoices WHERE guest_name = 'G'$q$, 0);
SELECT pg_temp.check('manager can delete invoices', :M, $q$DELETE FROM invoices WHERE guest_name = 'G'$q$, 1);
SELECT pg_temp.check('staff cannot create rate plans', :S, $q$INSERT INTO rate_plans (name, base_rate) VALUES ('Hack', 1)$q$, NULL, true);
SELECT pg_temp.check('manager can create rate plans', :M, $q$INSERT INTO rate_plans (name, base_rate) VALUES ('Corporate', 300)$q$, 1);
SELECT pg_temp.check('staff can record a settlement', :S, $q$INSERT INTO checkout_settlements (guest_name, total_due) VALUES ('H', 100)$q$, 1);
SELECT pg_temp.check('staff cannot alter settlements', :S, $q$UPDATE checkout_settlements SET total_due = 0$q$, 0);
SELECT pg_temp.check('manager can alter settlements', :M, $q$UPDATE checkout_settlements SET total_due = 90$q$, 1);
SELECT pg_temp.check('staff can log own sms', :S, $q$INSERT INTO sms_logs (event, phone, message, sent_by) VALUES ('checked_in', '233', 'hi', auth.uid())$q$, 1);
SELECT pg_temp.check('staff cannot rewrite sms status', :S, $q$UPDATE sms_logs SET status = 'DELIVERED'$q$, 0);
SELECT pg_temp.check('staff can still update room status', :S, $q$UPDATE rooms SET status = 'Occupied' WHERE id = 1$q$, 1);
SELECT pg_temp.check('staff can log housekeeping', :S, $q$INSERT INTO housekeeping_log (room_id, to_status) VALUES (1, 'Dirty')$q$, 1);
SELECT pg_temp.check('staff cannot delete housekeeping log', :S, $q$DELETE FROM housekeeping_log$q$, 0);
COMMIT;
\echo 'All authorization checks passed'
