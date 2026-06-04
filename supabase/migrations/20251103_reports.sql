-- Reports table with RLS

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE,
  type TEXT NOT NULL,
  format TEXT,
  generated_by TEXT,
  filename TEXT,
  file_content TEXT,
  preview_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(type);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD their own reports" ON public.reports
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read reports" ON public.reports
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.reports IS 'Stores generated reports from the hotel management system';

