-- Teacher notes per student
CREATE TABLE IF NOT EXISTS teacher_student_notes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL,
    teacher_id  TEXT,
    note        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_student_notes_student_created
    ON teacher_student_notes (student_id, created_at DESC);
