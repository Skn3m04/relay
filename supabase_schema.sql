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

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tickets Policies
CREATE POLICY "Users can see their own tickets" ON tickets FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE phone = (SELECT phone FROM profiles WHERE id = auth.uid()))
);
CREATE POLICY "CT Team can see all tickets" ON tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
);

-- Messages Policies
CREATE POLICY "Users can see messages for their tickets" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM tickets WHERE id = messages.ticket_id AND (user_id = auth.uid() OR assigned_to = auth.uid()))
);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (true);

-- Ticket Events Policies
CREATE POLICY "Agents can see all ticket events" ON ticket_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (team_type = 'CT Team' OR team_type = 'Admin'))
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
