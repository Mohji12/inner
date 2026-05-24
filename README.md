# Mijn Levenspad

Spiritual coaching marketing site plus a **mentor booking** flow (Vite + React + TypeScript + Tailwind). The UI talks to a **FastAPI** backend under `/api/v1` (see `backend/`).

## Scripts

- `npm run dev` — Vite dev server (default port **8080**)
- `npm run build` — production build
- `npm run preview` — preview production build

## Environment (frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Optional. API origin **without** trailing slash. If **unset**, requests use the **same origin** as the app (recommended in dev with the Vite proxy). Set to your API URL in production if the API is on another domain. |

Voice/video in chat uses **LiveKit**; the backend mints short-lived tokens (`POST /api/v1/chat/sessions/{id}/call/token`). Configure `LIVEKIT_*` on the API (see `backend/README.md`). No extra `VITE_*` secrets are required for LiveKit — the client receives the WebSocket URL in the token response.

Copy `.env.example` to `.env.local` and adjust if needed.

### Local dev: frontend + API

1. **Backend** (from `backend/`): install deps, configure `.env` (see `backend/README.md`), run migrations on MySQL, then start Uvicorn on port **8000**.
2. **Frontend**: `npm run dev` — Vite proxies `/api` → `http://127.0.0.1:8000`, so leave `VITE_API_URL` empty and open the app at `http://localhost:8080`.

Auth uses **JWT access tokens** (memory) and **httpOnly refresh cookies**; the client sends `credentials: 'include'` and refreshes on 401.

## End-to-end (QA)

1. **Mentor**: register at `/mentor/register`, then in MySQL set `mentors.status = 'active'` and `is_approved = 1` (new mentors start as pending / unapproved).
2. **Mentor**: log in → `/mentor/availability` → create slots.
3. **User**: register at `/register` or `/user/register`, log in → `/mentors` → open a mentor → pick slot → **Book** → pay placeholder on `/payment/:mentorId?bookingId=...`.
4. **Mentor**: confirm session flow in `/mentor/appointments` (mark completed, etc.).
5. **User**: after mentor marks **completed**, leave a review from `/user/appointments`.

## Project layout (booking-related)

- `src/api/` — client, `apiFetch`, domain modules (`auth`, `users`, `mentors`, `bookings`)
- `src/auth/AuthContext.tsx` — access token + login/logout per role
- `src/` routes (`App.tsx`): public `/mentors`, `/login`, `/register`; protected `/user/*`, `/mentor/*` with sidebars

Backend details and SQL migrations: **`backend/README.md`**.
