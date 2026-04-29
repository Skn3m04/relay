-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  team_type TEXT NOT NULL, -- 'Company Team', 'VS Team', 'CT Team', 'Admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'active', 'resolved')),
  assigned_to UUID REFERENCES profiles(id),
  subject TEXT, -- e.g. "Shift Issue", "RTO delivered"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  sla_deadline TIMESTAMPTZ,
  issue_type TEXT,
  city TEXT,
  lat NUMERIC,
  lon NUMERIC,
  escalated BOOLEAN DEFAULT FALSE,
  resolution_minutes INTEGER
);

-- Create sla_rules table
CREATE TABLE sla_rules (
  id SERIAL PRIMARY KEY,
  issue_type TEXT UNIQUE,
  priority TEXT,
  sla_minutes INTEGER
);

-- Create ticket_events table
CREATE TABLE ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- created, assigned, responded, resolved
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ticket_metrics view
CREATE OR REPLACE VIEW ticket_metrics AS
SELECT
  t.id,
  t.status,
  t.priority,
  t.created_at,
  t.resolved_at,
  t.first_response_at,
  EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/60 AS tat_minutes,
  EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/60 AS frt_minutes,
  (t.sla_deadline < NOW() AND t.status != 'resolved') AS sla_breached
FROM tickets t;

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Agents can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tickets Policies
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own tickets" ON tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Agents can see assigned or unassigned tickets" ON tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);
CREATE POLICY "Admins can see all tickets" ON tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND team_type = 'Admin')
);
CREATE POLICY "Agents can update assigned tickets" ON tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
);

-- Messages Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see messages for their tickets" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM tickets WHERE id = messages.ticket_id AND (user_id = auth.uid() OR assigned_to = auth.uid()))
);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (true);

-- Ticket Events Policies
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can see all ticket events" ON ticket_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
);

-- RPC for Daily Stats (Production Optimization)
CREATE OR REPLACE FUNCTION get_daily_ticket_stats(from_date TIMESTAMPTZ, to_date TIMESTAMPTZ)
RETURNS TABLE (
  date DATE,
  total BIGINT,
  resolved BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.created_at::date as date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE t.status = 'resolved') as resolved
  FROM tickets t
  WHERE t.created_at >= from_date AND t.created_at <= to_date
  GROUP BY t.created_at::date
  ORDER BY date DESC;
END;
$$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
