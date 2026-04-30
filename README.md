# Moshal Hackathon 2026 - Developer Guide

Welcome to the Moshal Hackathon 26 project! 🚀 
This repository contains the code for both the **Frontend** and the **Backend**, alongside the Database configuration.

## 👨‍💻 Team Structure
The team consists of 4 developers:
- **2 Frontend Developers** (Working in the `frontend/` directory)
- **2 Backend Developers** (Working in the `backend/` directory)

---

## 🏗️ Project Architecture

### 1. Frontend (Nuxt 3 + Vue 3 + TailwindCSS)
Located in the `frontend/` folder.
It's a modern, SSR-ready web application.

- **`frontend/nuxt.config.ts`**: The main configuration file. Contains Supabase environment variables.
- **`frontend/types/`**: Shared TypeScript interfaces (e.g., `types.ts`). **Backend developers should keep these in sync with the backend contracts.**
- **`frontend/services/`**: API calls and mock data (e.g., `mockService.ts`).
- **`frontend/tailwind.config.ts`**: Styling configurations.

#### 🏃‍♂️ How to run Frontend locally
1. Open terminal and navigate to the frontend folder: `cd frontend`
2. Install dependencies (if you haven't): `npm install`
3. Run the development server: `npm run dev`
4. Open your browser at `http://localhost:3000`

### 2. Backend (NestJS + TypeScript)
Located in the `backend/` folder.
It's a structured API server built with NestJS.

- **`backend/src/main.ts`**: The entry point of the server.
- **`backend/src/app.module.ts`**: The root module that imports all other modules.
- **`backend/src/ai/`**: Contains the `AIService` which is responsible for analyzing text using AI models (OpenAI/Anthropic/Gemini). It calculates jargon and soft skill scores.
- **`backend/src/webhooks/`**: Contains the `MondayController` (`monday.controller.ts`) which listens to webhooks coming from Monday.com and processes events.

#### 🏃‍♂️ How to run Backend locally
1. Open terminal and navigate to the backend folder: `cd backend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run start:dev`
4. The server runs usually on `http://localhost:3000` (Make sure to change the port if frontend runs on 3000, usually NestJS runs on 3000 by default. Set `PORT=3001` for backend in `.env` or in `main.ts`).

### 3. Database (Supabase)
Located in the `supabase/` folder.
- **`supabase/schema.sql`**: Contains the database tables and schemas. You can copy-paste this into your Supabase SQL Editor to set up the DB structure.

---

## 🔗 How Backend and Frontend Connect
1. **Types**: Make sure the interfaces in `backend/src/ai/ai.service.ts` (like `AIAnalysisRequest`) match exactly with `frontend/types/types.ts`.
2. **API Calls**: Frontend developers will write functions in `frontend/services/` to make HTTP calls (`fetch` or `axios`) to the backend endpoints (e.g., `http://localhost:3001/ai/...`).

## 🔑 Environment Variables
You will need `.env` files locally. **Do not commit them to Git.**
- **Frontend `.env`**: Needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
- **Backend `.env`**: Needs `OPENAI_API_KEY` (or equivalent), `MONDAY_WEBHOOK_SECRET`.

## 🐙 Git Workflow
- Always pull the latest code before starting work: `git pull origin master`
- If you make changes, commit them logically:
  ```bash
  git add .
  git commit -m "feat: added new AI feature"
  git push origin master
  ```
- Communicate with the team if you are changing shared types or database schemas!

Happy Coding! 🎉
