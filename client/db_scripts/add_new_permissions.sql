-- Add new permissions for Systems and Bar access if they don't exist

INSERT INTO public.permissions (name, description)
SELECT 'access_systems', 'Access to Systems Management page'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE name = 'access_systems'
);

INSERT INTO public.permissions (name, description)
SELECT 'access_bar', 'Access to Bar/Restaurant page'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE name = 'access_bar'
);

-- Verify insertion
SELECT * FROM public.permissions WHERE name IN ('access_systems', 'access_bar');
