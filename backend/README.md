# Mentor Booking API (FastAPI)

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env    # then edit values
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health: `GET http://127.0.0.1:8000/health`  
API: `http://127.0.0.1:8000/api/v1/...`

## Environment (`.env`)

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL / RDS |
| `JWT_SECRET_KEY` | Access JWT signing |
| `JWT_REFRESH_SECRET_KEY` | Not used with current HS256 single-secret; kept for parity — access uses `JWT_SECRET_KEY` |
| `JWT_ALGORITHM` | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default 15 (see `core/config.py` field names) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default 7 |
| `CORS_ORIGINS` | Comma-separated origins (e.g. `http://localhost:8080` for Vite) |
| `COOKIE_SECURE` | `false` locally; `true` in production behind HTTPS |
| `COOKIE_SAMESITE` | `lax` or `none` |
| `USER_REFRESH_COOKIE`, `MENTOR_REFRESH_COOKIE`, `ADMIN_REFRESH_COOKIE` | Cookie names |
| `LIVEKIT_URL` | WebSocket URL for LiveKit (e.g. `wss://your-project.livekit.cloud`). Leave empty to disable voice/video tokens. |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | From LiveKit Cloud (or self-hosted) — used only on the server to mint room JWTs. |
| `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` | Optional. Outbound SIP trunk id from LiveKit Cloud (after linking Twilio/Telnyx SIP). Required for `POST .../call/dial` (ring peer’s mobile). |
| `LIVEKIT_SIP_CALLER_ID` | Optional. E.164 caller ID (your provider number). Often **required** if the outbound trunk lists `*` or multiple numbers — set to the Twilio/Telnyx number LiveKit should use as “from”. |

Pydantic settings in `core/config.py` map env vars (lowercase with underscores).

## Database

Apply migrations to your MySQL database **in order**:

1. `migrations/001_initial_mentor_platform.sql` — base schema.
2. Optional: `migrations/002_seed.sql` — sample data.
3. `migrations/003_email_otp_verification.sql` — adds `email_verified` on `users` and `mentors`, OTP table. **Required** for the current app (admin bookings and auth expect these columns).
4. `migrations/004_admin.sql` — `admins` table and development administrator (admin dashboard).
5. Optional: `migrations/005_ensure_demo_mentor_visible.sql` — after `002` + `003`, marks seed demo user/mentor as verified and directory-visible.
6. `migrations/006_chat.sql` — paid metered text chat: `chat_sessions`, `chat_messages`, `chat_purchases`, mentor chat pricing columns. Enables demo mentor chat pricing when the seed mentor id exists.
7. Optional: `migrations/007_demo_phone_e164.sql` — sets demo `user@example.com` / `mentor@example.com` phone numbers to India E.164 for SIP dial testing (also reflected in `002_seed.sql` for new installs).

### Default admin (development only)

After `004_admin.sql` is applied, you can sign in via the frontend (**Login** → **Admin**) or call `POST /api/v1/auth/admin/login` with:

- **Email**: `admin@example.com`
- **Password**: `Admin123!`

Change this password or remove this row before production. See `.env.example` for the same note.

## API surface (v1)

- **Auth**: `POST /api/v1/auth/user/register|login|logout`, `POST .../refresh`; same for `/auth/mentor/...` and `/auth/admin/login|refresh|logout`
- **Admin** (Bearer access token, role `admin`): `GET /api/v1/admin/users|mentors|bookings|payments|reviews` (paginated); `GET /api/v1/admin/analytics?period=day|week|month|year`
- **Users**: `GET/PATCH /api/v1/users/me`
- **Mentors (public)**: `GET /api/v1/mentors`, `GET /api/v1/mentors/{id}`, `GET /api/v1/mentors/{id}/slots`, `GET /api/v1/mentors/{id}/chat-availability` — `{ available, reason }` (`chat_disabled` | `mentor_busy` | null). Public mentor payloads include `chat_price_per_minute`, `chat_currency`, `chat_min_purchase_minutes`, and `chat_available` (enabled and mentor not in a live session).
- **Mentor (self)**: `GET/PATCH /api/v1/mentors/me` (includes `chat_price_per_minute`, `chat_currency`, `chat_min_purchase_minutes`; `0` price disables chat), slots CRUD, `GET /api/v1/mentors/me/earnings`
- **Bookings**: `POST /api/v1/bookings`, `GET /api/v1/bookings/me`, `GET /api/v1/bookings/mentor/me`, `GET /api/v1/bookings/{id}`, patches, `POST .../pay`, `POST .../review` — creating a booking fails with `mentor_in_chat` if the mentor has a live chat (`status = active` and `ends_at` in the future).

### Metered chat (user ↔ mentor)

- **Purchases** are recorded in `chat_purchases` (dummy `succeeded` rows, fake `transaction_id`). Booking `payments` are not used for chat.
- **Messages** are stored in `chat_messages` (`sender_role` user/mentor, `body`, `created_at`). Invoices and PDFs include the full **conversation transcript** (both sides).
- **Time authority**: `chat_sessions.ends_at` (UTC). `remaining_seconds` is derived on read. **Extend**: `ends_at = max(now, ends_at) + purchased_minutes`.
- **Busy rule**: a mentor may have at most one **live** session (`active` and `ends_at > now`). Starting a second chat or a booking while busy is rejected.
- **REST** (Bearer user or mentor where noted):
  - `POST /api/v1/chat/sessions` — body `{ mentor_id, minutes }` (user; email must be verified).
  - `POST /api/v1/chat/sessions/{id}/extend` — body `{ minutes }` (user).
  - `GET /api/v1/chat/sessions/{id}` — participant (user or mentor).
  - `GET/POST /api/v1/chat/sessions/{id}/messages` — list supports `since_id`, `limit`; post body `{ body }`.
  - `POST /api/v1/chat/sessions/{id}/end` — participant.
  - `GET /api/v1/chat/sessions/active/me` — mentor only; returns active live session or `null`.
  - `GET /api/v1/chat/invoices` — user only; completed chat sessions with purchases (not live); summary for transaction history.
  - `GET /api/v1/chat/invoices/{session_id}` — user only; full invoice (line items from `chat_purchases`, bill-to, mentor, totals, session wall-clock duration).
  - `GET /api/v1/chat/invoices/{session_id}/pdf` — user only; **PDF download** (`application/pdf`, ReportLab).
- **WebSocket**: `WS /api/v1/ws/chat/{session_id}?token=<access_jwt>` — same participant rules as REST. Server pushes JSON `{ type: "new_message" | "session", data: ... }` after REST writes (in-process hub; single-server MVP). **Text only** — do not send raw audio over this socket.
- **Expiry**: sends are rejected when time has elapsed (`time_expired`); lazy `active` → `paused` transition on session reads. **Disconnect**: time keeps running (by design).

### Meetings (LiveKit WebRTC)

Chat messaging and WebRTC meetings are **separate APIs** linked by `chat_session_id` (correlation id). Bookings set `communication_mode` (`video` | `call`) and the shared session timer.

- **REST** (Bearer user or mentor):
  - `GET /api/v1/meetings/sessions/{chat_session_id}` — meeting metadata: `communication_mode`, `room_name`, `remaining_seconds`, `can_join`, `status`.
  - `POST /api/v1/meetings/sessions/{chat_session_id}/token` — mint LiveKit JWT; returns `{ provider, url, token, room_name, expires_in_seconds }`. Returns **503** if LiveKit env vars are not set.
- **Deprecated aliases** (delegate to meetings API; will be removed):
  - `POST /api/v1/chat/sessions/{id}/call/token` — same as meetings token endpoint.
  - `POST /api/v1/chat/sessions/{id}/call/dial` — outbound PSTN to peer profile phone via LiveKit SIP.
  - `POST /api/v1/chat/call/bridge` — dial two numbers into a standalone bridge room (not used for booked live sessions).

### Voice / video (LiveKit)

- **Room id** is derived as `chat-{session_id}`; no extra DB column is required.
- **Phone dial-out**: `users.phone_number` / `mentors.phone_number` should be stored in **E.164** (`+` and country code). The API does not dial arbitrary numbers—only the peer’s profile field for the session.
- **Production**: serve the SPA over **HTTPS**; browsers require a secure context for `getUserMedia` except on `localhost`.
- **TURN / NAT**: LiveKit Cloud includes TURN suitable for most networks; self-hosted setups should provision TURN (e.g. coturn) or use LiveKit’s managed TURN.
- **Firewall**: WebRTC uses UDP for media; some corporate networks block UDP — document this for users.
- **Privacy**: call media may be processed by LiveKit (subprocessor). Recording/retention are controlled in the LiveKit project, not in this repo by default.

## Approving a mentor for directory listing

New mentors are `pending` and not approved. The public directory (`GET /mentors`) returns only **`status = active`** and, by default, **`is_approved = 1`**. For local development you can set **`PUBLIC_MENTOR_LIST_INCLUDE_PENDING=true`** in `.env` so pending mentors appear in the list (still use `approved_only=false` from the dev frontend, or approve in SQL).

```sql
UPDATE mentors SET status = 'active', is_approved = 1 WHERE email = 'you@example.com';
```
