-- The Lab: tool catalog + session tracking

CREATE TABLE IF NOT EXISTS lab_tools (
    id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT    NOT NULL,
    description          TEXT,
    category             TEXT,
    is_available         BOOLEAN NOT NULL DEFAULT true,
    max_session_minutes  INTEGER DEFAULT 60,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id     UUID        REFERENCES lab_tools(id) ON DELETE SET NULL,
    purpose     TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'cancelled')),
    output_url  TEXT,
    notes       TEXT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS lab_sessions_team_id_idx ON lab_sessions (team_id);
CREATE INDEX IF NOT EXISTS lab_sessions_user_id_idx ON lab_sessions (user_id);

-- Default tool catalog
INSERT INTO lab_tools (name, description, category, max_session_minutes) VALUES
    ('מדפסת 3D',    'מדפסת FDM לדגמים ופרוטוטייפים',    '3d_printer',  120),
    ('לייזר קאטר',  'מכונת חיתוך לייזר לחומרים שונים',   'laser',        60),
    ('תחנת לחמה',   'לחמה ואלקטרוניקה — עבודת מעגלים',   'electronics',  45),
    ('מחשב עיצוב',  'תחנת עבודה לעיצוב גרפי ו-CAD',      'design',       90)
ON CONFLICT DO NOTHING;
