-- Migration 007: private DUDE conversation log
-- Stores every student ↔ DUDE private message so teachers can view and analyze them.

CREATE TABLE IF NOT EXISTS private_dude_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('student', 'dude')),
    content     TEXT        NOT NULL,
    analyzed    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_dude_user     ON private_dude_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_dude_analyzed ON private_dude_messages(user_id, analyzed) WHERE analyzed = FALSE;
