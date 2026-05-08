-- Teacher notes per group/team
CREATE TABLE IF NOT EXISTS teacher_group_notes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL,
    teacher_id  TEXT,
    note        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_group_notes_team_created
    ON teacher_group_notes (team_id, created_at DESC);
