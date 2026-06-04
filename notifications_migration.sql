-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    data JSONB DEFAULT '{}',
    url TEXT DEFAULT '/',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Create RLS policies for push_subscriptions
CREATE POLICY "Users can view their own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscription_updated_at();

-- Grant permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON push_subscriptions TO authenticated;

-- Create function to send notification to multiple users
CREATE OR REPLACE FUNCTION send_notification_to_users(
    user_ids UUID[],
    notification_title TEXT,
    notification_body TEXT,
    notification_type TEXT DEFAULT 'info',
    notification_data JSONB DEFAULT '{}',
    notification_url TEXT DEFAULT '/'
)
RETURNS SETOF notifications AS $$
BEGIN
    RETURN QUERY
    INSERT INTO notifications (user_id, title, body, type, data, url)
    SELECT 
        unnest(user_ids),
        notification_title,
        notification_body,
        notification_type,
        notification_data,
        notification_url
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send notification to department
CREATE OR REPLACE FUNCTION send_notification_to_department(
    department_name TEXT,
    notification_title TEXT,
    notification_body TEXT,
    notification_type TEXT DEFAULT 'info',
    notification_data JSONB DEFAULT '{}',
    notification_url TEXT DEFAULT '/'
)
RETURNS SETOF notifications AS $$
BEGIN
    RETURN QUERY
    INSERT INTO notifications (user_id, title, body, type, data, url)
    SELECT 
        id,
        notification_title,
        notification_body,
        notification_type,
        notification_data,
        notification_url
    FROM auth.users
    WHERE raw_user_meta_data->>'department' = department_name
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send notification to role
CREATE OR REPLACE FUNCTION send_notification_to_role(
    user_role TEXT,
    notification_title TEXT,
    notification_body TEXT,
    notification_type TEXT DEFAULT 'info',
    notification_data JSONB DEFAULT '{}',
    notification_url TEXT DEFAULT '/'
)
RETURNS SETOF notifications AS $$
BEGIN
    RETURN QUERY
    INSERT INTO notifications (user_id, title, body, type, data, url)
    SELECT 
        id,
        notification_title,
        notification_body,
        notification_type,
        notification_data,
        notification_url
    FROM auth.users
    WHERE raw_user_meta_data->>'role' = user_role
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION clean_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND read = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean old notifications (if pg_cron is available)
-- SELECT cron.schedule('clean-old-notifications', '0 2 * * *', 'SELECT clean_old_notifications()');
