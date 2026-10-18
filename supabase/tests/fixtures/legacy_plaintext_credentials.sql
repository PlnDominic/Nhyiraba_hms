-- TEST FIXTURE ONLY: recreates the insecure state that the old setup scripts produced,
-- so 20261023_remove_plaintext_passwords.sql can be tested against it.
CREATE TABLE public.staff_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_used BOOLEAN DEFAULT false,
  UNIQUE (user_id)
);
ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;
-- the policy fix_infinite_recursion_rls.sql used to add: every signed-in user could read every password
CREATE POLICY "allow_authenticated_access_staff_credentials" ON public.staff_credentials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.staff_credentials TO authenticated;

CREATE FUNCTION public.store_staff_credentials(p_user_id UUID, p_email TEXT, p_password TEXT)
RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;

CREATE FUNCTION public.admin_update_user_password(p_user_id UUID, p_password TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;

CREATE FUNCTION public.sync_staff_credentials_to_auth()
RETURNS INTEGER LANGUAGE sql AS $$ SELECT 0 $$;

CREATE VIEW public.staff_credentials_debug AS
  SELECT sc.user_id, sc.email, sc.password FROM public.staff_credentials sc;
CREATE VIEW public.staff_credentials_safe AS
  SELECT sc.user_id, sc.email FROM public.staff_credentials sc;

INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-0000000000e1', 'old1@x'), ('00000000-0000-0000-0000-0000000000e2', 'clean@x');
INSERT INTO public.user_profiles (user_id, full_name, role) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'Had stored password', 'staff'),
  ('00000000-0000-0000-0000-0000000000e2', 'Never stored', 'staff');
INSERT INTO public.staff_credentials (user_id, email, password) VALUES ('00000000-0000-0000-0000-0000000000e1', 'old1@x', 'Welcome123');
