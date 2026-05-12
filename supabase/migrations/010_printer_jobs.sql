-- Printer Operation: job queue managed by the hardware-role student

CREATE TABLE IF NOT EXISTS printer_jobs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id       UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    submitted_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id       UUID        REFERENCES tasks(id) ON DELETE SET NULL,
    title         TEXT        NOT NULL,
    description   TEXT,
    file_url      TEXT,
    copies        INTEGER     NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 20),
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'printing', 'done', 'cancelled')),
    operator_notes TEXT,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS printer_jobs_team_id_idx ON printer_jobs (team_id);
CREATE INDEX IF NOT EXISTS printer_jobs_status_idx  ON printer_jobs (status);
