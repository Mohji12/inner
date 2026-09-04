# Changelog / project updates

Living log of work done on this project.  
**Rule:** every meaningful change is recorded here with the date (`YYYY-MM-DD`).

---

## 2026-09-04

### Promo / WELCOME5 — coach no-show restore
**Goal:** If a coach misses a booking that consumed a welcome promo, restore the promo so the user can use it again.

- Added `reverse_promo_redemption_for_booking` in `backend/services/promo_service.py`
- Coach-miss detection via join timestamps in `backend/services/live_session_service.py`
- Wired restore into `backend/services/no_show_service.py` and mentor mark-unattended in `backend/api/v1/bookings.py`
- Tests: `backend/tests/test_promo_service.py`, `backend/tests/test_no_show_promo_restore.py`

### Coach dashboard — join live appointment CTA
**Goal:** Coaches can see and join an active/waiting live appointment from the home dashboard.

- Live join target via `resolveMentorLiveJoinTarget` in `src/lib/bookingChatLinks.ts` (+ tests)
- UI on `src/pages/mentor/MentorDashboardHomePage.tsx`
- Backend active session also returns paused join-window rooms
- i18n under `mentorDashboardHome` (EN + Dutch)

### Timezones — browser timezone on auth
**Goal:** Stop hardcoding UTC at registration; store the user’s browser timezone.

- `backend/services/timezone_service.py` helpers
- Auth schemas / APIs updated; frontend `src/api/auth.ts` sends timezone via `withBrowserTimezone`
- Tests: `backend/tests/test_timezone_service.py`

### Chat load performance
**Goal:** Faster chat open and less polling / refetch waste.

- Newest ~50 messages; parallel prefetch; softer polling; dirty-only session commits
- DB index `ix_chat_messages_session_created`
- Files: `backend/services/chat_service.py`, `ChatSessionPage.tsx`, `ChatPanel.tsx`, `useChatWebSocket.ts`
- Tests: `backend/tests/test_chat_list_messages.py`

### i18n — unified “Appointment” wording (user + coach)
**Goal:** Same term for user and coach: Appointment / Afspraak (not Session / Sessie mix).

- Coach nav + appointments page i18n; `mentorAppointments` copy block
- Dutch and other locales aligned in `appBase.ts`, `appOverrides.ts`, `coachDashboardOverrides.ts`
- `src/pages/mentor/MentorAppointmentsPage.tsx` wired to translations

### User dashboard — wallet on KPI row
**Goal:** Wallet on the top KPI line with top-up and book actions.

- Wallet first KPI: balance, quick €5/€10/€20/€50, Add money, Book appointment → `/user/mentors`
- Wallet page prefills `?amount=` (`src/pages/user/WalletPage.tsx`)
- `src/pages/user/UserDashboardHomePage.tsx` + `dashboardUser` i18n (EN + NL)

### Update log process
**Goal:** Keep a permanent dated record of changes.

- Created folder `update/` and this living file `update/CHANGELOG.md`
- Added Cursor rule `.cursor/rules/document-updates.mdc` so future changes are documented here with the date
