-- Create user_settings table to store user preferences, notifications, and security settings
-- This table stores user-specific settings that persist across sessions

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Preferences
  language TEXT DEFAULT 'English',
  timezone TEXT DEFAULT 'GMT+0',
  date_format TEXT DEFAULT 'MM/DD/YYYY', -- stored as date_format in DB, mapped to dateFormat in code
  time_format TEXT DEFAULT '12-hour', -- stored as time_format in DB, mapped to timeFormat in code
  currency TEXT DEFAULT 'GHS',
  theme TEXT DEFAULT 'light', -- light or dark
  
  -- Notifications (stored as JSONB for flexibility)
  notifications JSONB DEFAULT '{
    "email": true,
    "sms": false,
    "browser": true,
    "app": true
  }'::jsonb,
  
  -- Security settings
  two_factor_enabled BOOLEAN DEFAULT false,
  session_timeout TEXT DEFAULT '30 minutes',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own settings
CREATE POLICY "Users can view their own settings"
ON user_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert their own settings"
ON user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update their own settings"
ON user_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_settings_updated_at();

-- Create a function to get or create user settings
CREATE OR REPLACE FUNCTION get_or_create_user_settings(p_user_id UUID)
RETURNS user_settings AS $$
DECLARE
  v_settings user_settings;
BEGIN
  -- Try to get existing settings
  SELECT * INTO v_settings
  FROM user_settings
  WHERE user_id = p_user_id;
  
  -- If no settings exist, create default ones
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_settings;
  END IF;
  
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

