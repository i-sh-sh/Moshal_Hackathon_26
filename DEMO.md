# Run the demo (no backend, no DB)

The `nissim/backend-foundation` branch ships with a self-contained POC:
all mission data, students, quizzes, and hints live as hardcoded fixtures
in `frontend/services/demoData.ts`. You don't need Supabase, you don't
need to run the NestJS backend, you don't need to set any env var.

## Quick start (Windows PowerShell)

```powershell
# 1. Clone + checkout the demo branch
git clone https://github.com/i-sh-sh/Moshal_Hackathon_26.git
cd Moshal_Hackathon_26
git checkout nissim/backend-foundation

# 2. Install + run the frontend
cd frontend
npm install
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run dev
```

(On macOS/Linux replace the `$env:` line with `export NODE_OPTIONS="--max-old-space-size=8192"`.)

When you see `Listening on http://localhost:3000`, open that URL in a
browser. The login screen lists 10 demo users — pick `Teacher Demo` for
the teacher dashboard or any student name for the student dashboard.

## What works in the demo

- **Login** — 10 hardcoded users (8 students + teacher + admin),
  Hebrew RTL with TechSchool logo & cyan theme. Smart redirect:
  teacher → `/teacher`, student → `/student`.
- **Teacher dashboard → Missions tab** — 3 real TechSchool missions
  (gift / puzzle / style) in Hebrew. Per-team state machine on each card:
  - **🚀 פתח לצוות** — opens the mission for that team
  - **👥 שבץ תפקידים** — inline RoleAssignmentPanel with auto-rotate
    (`⚡ שיבוץ אוטומטי`) or manual save (`💾 שמור שיבוץ`)
  - **🏁 סגור משימה** — marks team as completed (unlocks post-quiz)
  - **🔄 פתח מחדש** — re-opens a completed mission
- **Student dashboard → Pre/Post-mission quizzes** — each pre-quiz draw
  mixes ~3 role-knowledge + ~2 mission-specific questions in Hebrew.
  Post-quiz reuses the pre questions and computes `learning_gain`
  (post − pre) locally.
- **💡 רמזים (hints)** — pool of 10 curated Hebrew hints, first 3 free,
  rest cost 10 points each.

State is in-memory: refreshing the page resets role assignments and quiz
attempts. Acceptable for a demo.

## Backend (optional, not needed for demo)

If you ever want the real backend running:

```powershell
cd backend
npm install
# Fill in backend/.env from backend/.env.example (Supabase URL+service key min)
npm run start:dev
```

The frontend will still primarily use the demo fixtures — switching to
live API requires editing `frontend/composables/useTeacher.ts` and
`useQuizzes.ts` to re-introduce `$fetch` calls.

## Memory note: dev-server stability on OneDrive

If the project lives inside a OneDrive-synced folder, the Vite file
watcher can fight OneDrive sync and the dev server eventually OOMs.
Either move the project off OneDrive, or pause OneDrive sync for the
folder, or just bump `--max-old-space-size=8192` (already in the
quick-start above) and restart the dev server every couple of hours.
