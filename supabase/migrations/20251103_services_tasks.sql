-- Services and Service Requests with RLS

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  room VARCHAR(255) NOT NULL,
  service_id INTEGER REFERENCES services(id),
  service_name VARCHAR(255) NOT NULL,
  requested_by VARCHAR(255) NOT NULL,
  guest_id UUID,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_services_available ON services(available);
CREATE INDEX IF NOT EXISTS idx_service_requests_room ON service_requests(room);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_id ON service_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_access_services ON services FOR ALL USING (true);
CREATE POLICY anon_access_service_requests ON service_requests FOR ALL USING (true);
CREATE POLICY auth_access_services ON services FOR ALL USING (true);
CREATE POLICY auth_access_service_requests ON service_requests FOR ALL USING (true);

-- Tasks with RLS
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  room VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  assignee VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_room ON tasks(room);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_access ON tasks FOR ALL USING (true);
CREATE POLICY auth_access ON tasks FOR ALL USING (true);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_services_timestamp ON services;
CREATE TRIGGER set_services_timestamp BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_service_requests_timestamp ON service_requests;
CREATE TRIGGER set_service_requests_timestamp BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_tasks_timestamp ON tasks;
CREATE TRIGGER set_tasks_timestamp BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_modified_column();

