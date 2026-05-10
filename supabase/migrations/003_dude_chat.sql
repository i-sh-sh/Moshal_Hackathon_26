-- 003_dude_chat.sql
-- DUDE system: group chat channels, AI bot, student learning profiles.

-- ── Chat channels (one per team) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id)
);

-- ── Chat messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name  TEXT NOT NULL,
    is_bot       BOOLEAN NOT NULL DEFAULT false,
    content      TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Channel participants ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_participants (
    channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member',   -- member | teacher | bot
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

-- ── Analysis log (one entry per automated analysis run) ──────────────────────
CREATE TABLE IF NOT EXISTS channel_analysis_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id     UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    message_count  INT NOT NULL DEFAULT 0,
    summary        TEXT
);

-- ── Per-student learning profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jargon_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    soft_skill_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
    detected_terms     TEXT[] NOT NULL DEFAULT '{}',
    messages_analyzed  INT NOT NULL DEFAULT 0,
    last_analyzed_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- ── Profile snapshots (historical progress tracking) ─────────────────────────
CREATE TABLE IF NOT EXISTS profile_snapshots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jargon_score      NUMERIC(5,2) NOT NULL,
    soft_skill_score  NUMERIC(5,2) NOT NULL,
    detected_terms    TEXT[] NOT NULL DEFAULT '{}',
    snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teacher alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    channel_id  UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
    alert_type  TEXT NOT NULL,   -- 'knowledge_gap' | 'low_engagement' | 'stuck'
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Jargon events (per-message term detection) ────────────────────────────────
CREATE TABLE IF NOT EXISTS jargon_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    message_id   UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    term         TEXT NOT NULL,
    context      TEXT,
    detected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel    ON chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_participants_user ON channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_alerts_unread    ON teacher_alerts(is_read, created_at) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user   ON profile_snapshots(user_id, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_jargon_events_user       ON jargon_events(user_id, detected_at);
