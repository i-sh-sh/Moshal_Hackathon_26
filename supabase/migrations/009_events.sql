-- Events Board: school events, deadlines, announcements
-- team_id NULL = visible to all teams

CREATE TABLE IF NOT EXISTS events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT        NOT NULL,
    description  TEXT,
    event_date   TIMESTAMPTZ NOT NULL,
    event_type   TEXT        NOT NULL DEFAULT 'event'
                             CHECK (event_type IN ('event', 'deadline', 'announcement')),
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    team_id      UUID        REFERENCES teams(id) ON DELETE CASCADE,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_event_date_idx ON events (event_date);
CREATE INDEX IF NOT EXISTS events_team_id_idx    ON events (team_id);

-- Seed example events
INSERT INTO events (title, description, event_date, event_type) VALUES
    ('הגשת אתגר 1', 'מועד אחרון להגשת האתגר הראשון', NOW() + INTERVAL '7 days', 'deadline'),
    ('יום פתוח TechSchool', 'מפגש הורים ומציגים — כל הקבוצות מציגות', NOW() + INTERVAL '14 days', 'event'),
    ('הודעה: חג החינוך', 'אין שיעורים ב-15 לחודש', NOW() + INTERVAL '3 days', 'announcement')
ON CONFLICT DO NOTHING;
