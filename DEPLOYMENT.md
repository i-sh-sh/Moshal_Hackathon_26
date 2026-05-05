# Deployment Guide — Neon + Render + Netlify (Free Tier)

This stack is 100% free with no credit card required.

| Service | What it hosts | Free limits |
|---------|--------------|-------------|
| **Neon** | PostgreSQL database | 0.5 GB storage, 190 compute hours/month |
| **Render** | NestJS backend API | 750 hours/month (sleeps after 15 min idle) |
| **Netlify** | Nuxt 3 SSR frontend | 100 GB bandwidth, 300 build minutes/month |

---

## 1 — Database: Neon

1. Go to <https://neon.tech> → **Start for free**
2. Create a project (name: `teamsprintup`, region: EU Frankfurt or closest to you)
3. After creation, open **Connection Details** → copy the **Connection string**  
   It looks like:  
   `postgresql://teamsprintup_owner:PASS@ep-xxx.eu-central-1.aws.neon.tech/teamsprintup?sslmode=require`
4. Run the schema in the SQL editor (paste contents of `supabase/schema.sql`)
5. Run the seed (see §4 below)

---

## 2 — Backend: Render

1. Go to <https://render.com> → sign in with GitHub
2. **New → Web Service** → connect the `Moshal_Hackathon_26` repository
3. Settings:
   - **Root directory**: `backend`
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm run start:prod`
   - **Plan**: Free
4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | your Neon connection string from step 1 |
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `CORS_ORIGINS` | `https://YOUR-SITE.netlify.app` (fill after step 3) |
   | `PORT` | `3001` |
   | `NODE_ENV` | `production` |

5. Click **Create Web Service** — the first deploy starts automatically.  
   Your API URL will be `https://teamsprintup-backend.onrender.com/api`

> **Note:** The free Render plan sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 s. For a hackathon demo this is fine; upgrade to Starter ($7/mo) to remove sleep.

---

## 3 — Frontend: Netlify

1. Go to <https://netlify.com> → **Add new site → Import an existing project**
2. Connect GitHub and select `Moshal_Hackathon_26`
3. Settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `.output/public`
4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `NUXT_PUBLIC_API_BASE_URL` | `https://teamsprintup-backend.onrender.com/api` |
   | `NITRO_PRESET` | `netlify` |

5. Click **Deploy site** — your site will be live at `https://xxx.netlify.app`
6. Go back to Render and set `CORS_ORIGINS` to your Netlify URL, then **Manual Deploy → Deploy latest commit** to pick up the change.

---

## 4 — Seed the database

After the Neon database is created and the schema applied:

```bash
cd backend
DATABASE_URL="postgresql://..." node -r ts-node/register src/seed.ts
```

Or, if you have ts-node installed globally:

```bash
cd backend
DATABASE_URL="postgresql://..." npx ts-node src/seed.ts
```

This inserts one challenge, one sprint, four teams, and sample tasks with QA checklists.

---

## 5 — Local development

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env          # fill in DATABASE_URL and ANTHROPIC_API_KEY
npm install
npm run start:dev

# Terminal 2 — frontend
cd frontend
cp .env.example .env          # NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
npm install
npm run dev
```

Open `http://localhost:3000` — click a student avatar to log in.

---

## 6 — Custom domain (optional)

- **Netlify**: Site settings → Domain management → Add custom domain (free SSL via Let's Encrypt)
- **Render**: Settings → Custom domains (same process, free SSL)

Update `CORS_ORIGINS` on Render whenever you add a domain.
