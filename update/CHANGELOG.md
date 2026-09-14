# Changelog / project updates

Living log of work done on this project.  
**Rule:** every meaningful change is recorded here with the date (`YYYY-MM-DD`).

---

## 2026-09-14

### Fix mentor refresh 500 (naive vs aware datetimes)
**Goal:** Stop `rotate_refresh_token` crashing on multi-tab refresh grace path.

- MySQL returns naive `expires_at` / `revoked_at`; compare after normalizing to UTC
- Key paths: `backend/services/token_service.py`, `backend/tests/test_token_service.py`

### Fix coach profile 500 (DeepL batch form)
**Goal:** Coach detail page was showing “Coach not found” because `GET /mentors/{id}` crashed.

- `translate_texts` posted form data as a list of tuples; httpx/h11 raised `TypeError` during request encoding
- Use dict + list `text` values (repeated keys) instead; soft-fail unexpected tag-batch errors
- Key paths: `backend/services/deepl_service.py`, `backend/tests/test_deepl_service.py`

### Faster coach list: cache-first DeepL
**Goal:** Stop blocking coach browse on live DeepL (was 30–40s).

- Mentor **list/similar** return immediately from i18n cache; missing langs warm in a background task
- Batch tag translation in one DeepL HTTP call; slightly lower request pacing
- Key paths: `backend/api/v1/mentors_public.py`, `backend/services/deepl_service.py`

### Coach browse cards: headline + expertise tags via DeepL
**Goal:** Translate coach card headlines and expertise tags for the viewer language (not only static UI).

- Public mentor **list** translates headline + tags with a per-request DeepL budget (avoids Free-tier 429)
- New `expertise_areas_i18n` / `skills_i18n` JSON caches on mentors; shared in-process tag memo
- Chinese `mentorBrowseCard` status/labels added to generated overrides
- Key paths: `backend/services/deepl_service.py`, `backend/api/v1/mentors_public.py`, `backend/models/mentor.py`, `src/i18n/deeplGeneratedOverrides.ts`

### Coach detail UI via DeepL + similar coach headlines
**Goal:** Translate coach-detail page copy (pricing help, buttons) and similar-coach headlines with DeepL.

- Moved hardcoded English pricing/help strings on `MentorDetailPage` into `appBase` i18n keys
- Filled missing `mentorDetail.*` locale gaps via DeepL into `deeplGeneratedOverrides.ts`
- Similar coaches endpoint now translates request-lang headlines (detail path already did)
- Key paths: `src/pages/MentorDetailPage.tsx`, `src/i18n/appBase.ts`, `src/i18n/deeplGeneratedOverrides.ts`, `backend/api/v1/mentors_public.py`

### DeepL rate-limit hardening (coach list 429)
**Goal:** Stop Free-tier DeepL 429 spam when browsing coaches.

- Public mentor **list** no longer calls DeepL (resolve existing i18n / fallback only)
- Coach **detail** translates only the request language (not all langs at once)
- Failed translations are not cached as source text; 429 retries with backoff + pacing
- Key paths: `backend/services/deepl_service.py`, `backend/api/v1/mentors_public.py`

### DeepL translation (UI script + coach + announcements)
**Goal:** Machine-translate coach public copy and admin notifications; operator script for website UI locale gaps.

- Backend `deepl_service` (`translate_text`, `ensure_i18n_map`) with Free API defaults; soft-fail without `DEEPL_AUTH_KEY`
- Public mentor GET fills/persists missing `headline_i18n` / `bio_i18n` for the request language
- Admin announcements build full `title_i18n` / `body_i18n` before creating in-app notifications (email stays in source language)
- Operator script `backend/scripts/translate_ui_copy.py` fills `src/i18n/deeplGeneratedOverrides.ts` from EN `appBase` (merged in `appOverrides`)
- Key paths: `backend/services/deepl_service.py`, `backend/api/v1/mentors_public.py`, `backend/services/admin_announcement_service.py`, `backend/scripts/translate_ui_copy.py`, `backend/.env.example`

## 2026-09-13

### Registration QR uses production URL
**Goal:** Phone scanners open the live site, not localhost.

- Verify QR / copy link use `https://mijnlevenspad.com` (override with `VITE_PUBLIC_APP_URL`)
- Key paths: `src/pages/UserRegisterPage.tsx`, `.env.example`

### Remove gender/DOB from user registration
**Goal:** Simplify the user signup form.

- Removed Gender and Date of birth fields from `UserRegisterPage`
- Help copy updated (EN + NL)
- Key paths: `src/pages/UserRegisterPage.tsx`, `src/i18n/appBase.ts`, `src/i18n/appOverrides.ts`

### QR + OTP user registration verification
**Goal:** After register, users can verify via email OTP or by scanning a QR magic link.

- Pending signup stores a one-time `verify_token_hash` (issued on register/resend)
- `POST /auth/user/verify-link` creates the user and logs them in
- Register verify UI shows QR + copy/open link alongside OTP
- Landing page `/user/verify-link` consumes the token
- Key paths: `backend/services/pending_user_registration_service.py`, `backend/api/v1/auth_user.py`, `src/pages/UserRegisterPage.tsx`, `src/pages/UserVerifyLinkPage.tsx`

### Fix online badge vs not-available book/talk glitch
**Goal:** Stop users seeing a coach as Online / bookable, then getting “not available” on Book or Talk now.

- Unified live gates via `live_availability_block_reason` (effective online + mode-aware occupied)
- Book/talk and `/chat-availability` use the same rules as the public badge
- Coach detail refetches availability before Book/Talk now; dialog shows the real block reason
- Faster presence refresh on coach detail (8s)
- Key paths: `backend/services/mentor_availability_service.py`, `backend/services/chat_service.py`, `backend/services/booking_service.py`, `src/pages/MentorDetailPage.tsx`

## 2026-09-12

### Admin messages to users
**Goal:** Let admins email/message users the same way as coaches.

- Extended announcements with `audience` (`coach` | `user`) and optional `user_id`
- In-app notification + optional SMTP for all/one active verified user
- Admin UI: choose Coaches or Users, then all/one recipient
- User dashboard shows unread admin messages (like coach dashboard)
- Schema: `admin_announcements.audience` via startup ensure
- Key paths: `backend/services/admin_announcement_service.py`, `src/pages/admin/AdminAnnouncementsPage.tsx`, `src/pages/user/UserDashboardHomePage.tsx`

### Contact form anti-spam
**Goal:** Stop bot spam from the public website contact form flooding support inboxes.

- Honeypot field (`website`) — bots that fill it get a fake success, no email
- Minimum form fill time (~3s) via `form_started_at`
- Stronger gibberish filter (blocks `zsMSEqMR7F` / `FFjFTtCqaX`-style spam silently)
- Public contact rate limit tightened to 3/hour
- Key paths: `backend/services/contact_anti_spam.py`, `backend/api/v1/contact.py`, `src/components/SupportQueryForm.tsx`

### Support mail Reply-To = user/coach
**Goal:** `support_contact_emails` get inquiries that reply to the real user/coach; OTP, session, and admin→coach stay on platform SMTP.

- Support emails still send via SMTP From (`SMTP_FROM_EMAIL`) for deliverability
- From display name is `Mijn Levenspad Support`; `Reply-To` is the user/coach email
- Treat SMTP non-acceptance as a send failure; keep OTP/admin announcements on platform SMTP
- Key paths: `backend/services/email_service.py`, `backend/services/support_inquiry_service.py`

### Support mailto button for user and coach
**Goal:** Users and coaches can open their default mail app to email `info@mijnlevenspad.com` directly.

- Added outline button next to Send message on user/coach Support pages
- Prefills subject/body (and account name/email) via `mailto:`
- Key paths: `src/components/SupportQueryForm.tsx`, `src/pages/user/UserSupportPage.tsx`, `src/pages/mentor/MentorSupportPage.tsx`

### Bold OTP inbox hint on register/login
**Goal:** Make the “check your inbox for the verification code” notice impossible to miss.

- Restyled `OtpEmailHint` with amber attention badge, stronger border, and spam tip line
- Used on user/coach register and login verify flows
- Key paths: `src/components/OtpEmailHint.tsx`

### Session extend: wallet or Mollie
**Goal:** Users can pay to extend an ongoing session from wallet or via Mollie.

- New `POST /chat/sessions/{id}/extend/wallet` debits wallet and adds minutes instantly
- Extend dialog shows Pay from wallet and Pay with Mollie options
- Key paths: `backend/services/chat_service.py`, `src/components/chat/SessionExtendDialog.tsx`

## 2026-09-11

### Bulk-verify all user emails
**Goal:** Admin Users list shows Email verified = Yes for existing accounts.

- Set `email_verified=true` for all users that were still unverified
- Script: `backend/scripts/verify_all_user_emails.py`

### Create user account only after email OTP
**Goal:** Unverified signups no longer appear in Admin → Users.

- Register stores details in `pending_user_registrations` and emails OTP
- `users` row is created only after successful OTP verify (`email_verified=true`)
- Resend OTP works against pending signups; legacy unverified users still supported
- Key paths: `backend/services/pending_user_registration_service.py`, `backend/api/v1/auth_user.py`, `backend/models/pending_user_registration.py`

### Coach dashboard status buttons (online / offline / paused / occupied)
**Goal:** Coaches can set their status with four explicit buttons on the dashboard.

- Added `presence_mode` on mentors and `PATCH /mentors/me/presence-mode`
- Replaced availability toggle with Online, Offline, Paused, Occupied buttons
- Offline stops heartbeats and hides the coach; paused/occupied block new bookings
- Key paths: `src/components/CoachPresenceBanner.tsx`, `backend/services/mentor_presence_mode_service.py`, `backend/api/v1/mentor_me.py`

### Coach mobile join UX (toasts vs CTA)
**Goal:** Coaches can accept/join a live session on phone without notifications covering the Join button.

- Sticky bottom Join bar on mentor dashboard (mobile) above the fold, z-index above content
- Sonner toasts moved to top-center with close button; mentors only get “session ready” toast + Join action
- Skip stacking “booking started” toast for mentors (sound still plays)
- Key paths: `src/components/CoachLiveJoinBar.tsx`, `src/components/ui/sonner.tsx`, `src/components/NotificationBell.tsx`, `src/pages/mentor/MentorDashboardHomePage.tsx`

### Stop automatic session-booked emails to coaches
**Goal:** Coaches no longer get email when a session is booked; only admin can email coaches.

- Removed booking-confirmed SMTP email from payment success path
- Coaches still get in-app (bell) “Session ready to join” notifications
- Admin announcements can still email coaches
- Key paths: `backend/services/mollie_service.py`, `backend/services/booking_notify.py`

### Pause session timer during extend payment
**Goal:** When a user pays to extend an ongoing session, billed time freezes until Mollie settles (or payment fails).

- Freeze remaining seconds on extend checkout; resume + add minutes on paid
- Restore frozen time if Mollie fails/cancels/expires
- Faster post-checkout Mollie sync polling; UI banner while timer is paused
- Key paths: `backend/services/live_session_service.py`, `backend/services/chat_service.py`, `backend/services/mollie_service.py`, `src/pages/chat/ChatSessionPage.tsx`

## 2026-09-08

### Coach no-show alert after 5 minutes
**Goal:** If the coach never joins, after 5 minutes the user gets an alert to end the session, get a wallet refund, and find another coach.

- Dialog + banner when user has been waiting for coach for 5 minutes
- End session triggers existing wallet refund; navigates to `/mentors`
- Key paths: `src/components/chat/CoachNoShowDialog.tsx`, `src/pages/chat/ChatSessionPage.tsx`, `src/i18n/appBase.ts`, `src/i18n/chatOverrides.ts`

### Point local frontend at production API
**Goal:** Local Vite SPA talks to the production backend instead of the local `:8001` proxy.

- Set root `.env` `VITE_API_URL=https://life.mijnlevenspad.com`
- Restart `npm run dev` for the change to apply
- Key path: `.env`

### Fix 5-min session showing a 30-min time range
**Goal:** Session cards show start–end matching the booked duration (e.g. 5 min), not the 30-minute join window.

- On payment, `booking.end_at_utc` is set to start + duration; chat `ends_at` still holds the join deadline
- UI derives display end from start + duration (heals older rows that stored the join window as end)
- Key paths: `backend/services/mollie_service.py`, `src/lib/sessionBooking.ts`, `src/lib/bookingChatLinks.ts`, `src/pages/user/UserAppointmentsPage.tsx`, `src/pages/mentor/MentorAppointmentsPage.tsx`

### Silence AudioContext autoplay console spam
**Goal:** Stop repeated “AudioContext was not allowed to start” warnings from notification sounds.

- Create/resume Web Audio only after a user gesture; remove unlock listeners after first gesture
- Skip generated-chime fallback until audio is unlocked
- Key path: `src/lib/notificationSound.ts`

### Fix earnings lock-wait timeout
**Goal:** Coach dashboard `/earnings` and marketplace wallet reads no longer hit MySQL `1205 Lock wait timeout` when creating/loading wallet accounts.

- Read endpoints use `get_or_create_wallet_account(..., lock=False)` (no `FOR UPDATE`)
- Create path retries briefly on lock-wait timeouts
- Key paths: `backend/services/ledger_service.py`, `backend/api/v1/mentor_me.py`, `backend/api/v1/marketplace.py`

### Smaller accessibility floating button
**Goal:** Reduce the size of the floating accessibility symbol so it does not dominate the page.

- Floating button set to **24px** (`h-6 w-6`)
- Key path: `src/components/accessibility/AccessibilityWidget.tsx`

### Fix promo create-intent 500 on duplicate redemption
**Goal:** Free/promo checkout no longer crashes with IntegrityError when the user already has a promo redemption row.

- `apply_promo_code` rebinds an existing `(user, promo)` redemption to the new booking instead of inserting a duplicate
- `payments/create-intent` maps `PromoError` to HTTP 400
- Key paths: `backend/services/promo_service.py`, `backend/api/v1/payments.py`, `backend/tests/test_promo_service.py`

### Fix booking times shown in UTC instead of local
**Goal:** Appointment/session times match the viewer’s local timezone (e.g. IST).

- API naive datetimes were parsed as browser-local; treat them as UTC (`parseApiUtcDate`) in formatters and booking logic
- Serialize booking/chat datetime fields with a trailing `Z` via `UtcDateTime`
- Key paths: `src/lib/timeZone.ts`, `src/lib/bookingChatLinks.ts`, `src/lib/sessionBooking.ts` (via formatters), `backend/schemas/utc_datetime.py`, `backend/schemas/booking.py`, `backend/schemas/chat.py`

### Login role URL + admin error message
**Goal:** Role toggles on the login page update `?role=` in the URL, and failed admin/user logins no longer show a coach-only hint.

- Selecting User / Coach / Admin now writes `?role=` via `setSearchParams`
- Generic invalid-credentials copy no longer says “Coaches must use the Coach login option”
- Key paths: `src/pages/LoginPage.tsx`, `src/lib/humanizeApiError.ts`

### Invoice PDFs follow selected platform language
**Goal:** Invoice PDF/JSON labels use the UI language from `Accept-Language` for every supported locale.

- Expanded `invoice_pdf_i18n` catalogs to all platform languages (en, nl, fr, es, de, it, ro, ar, zh, ru), including settlement/monthly copy
- Wired `lang` through mentor chat, admin booking/chat/settlement/monthly, and mentor settlement/monthly PDF downloads
- Unicode PDF fonts (Arial / YaHei) so non-Latin labels render; API client default language aligned to `nl`
- Key paths: `backend/services/invoice_pdf_i18n.py`, `backend/services/invoice_pdf_fonts.py`, `backend/services/*_invoice_pdf.py`, `backend/api/v1/{chat,invoices,mentor_me,admin_router}.py`, `src/api/client.ts`

### Responsive layout alignment fixes
**Goal:** Fix overflow and misaligned public UI across phone, tablet, and laptop widths.

- Navbar: compact Account dropdown for signed-in roles; smaller logo/nav gaps to prevent overflow
- Hero + pricing promo banners stack cleanly on narrow screens; CTAs full-width on mobile
- Coach browse cards: shorter mobile image, stacked name/status, `min-w-0` wrapping
- Package grid: single-column on small phones, tighter card padding on dense layouts
- Key paths: `src/components/Navbar.tsx`, `src/components/HeroSection.tsx`, `src/components/MentorBrowseCard.tsx`, `src/components/ConsultationPackagesSection.tsx`, `src/i18n/appBase.ts`, `src/i18n/appOverrides.ts`

### Coach pause status on public cards
**Goal:** When a coach pauses from the dashboard, browse/profile cards show **Paused** (not Online / In session), including on mobile.

- Public API now returns `manual_occupied` on mentor cards
- `getMentorAvailabilityStatus` maps paused coaches to `paused`
- Updated `MentorBrowseCard` + `MentorDetailPage` badges/CTAs
- Key paths: `backend/schemas/mentor.py`, `backend/api/v1/mentors_public.py`, `src/api/types.ts`, `src/components/MentorBrowseCard.tsx`, `src/pages/MentorDetailPage.tsx`

### Public nav — login as another role (multi-session)
**Goal:** On the homepage, a tab can stay role-neutral and still open Login as coach even when a user session exists in another tab.

- Stop auto-picking a role from localStorage on public pages (`detectInitialRole`)
- Navbar shows a hub button for each signed-in role **and** “Login as another role”
- Key paths: `src/auth/AuthContext.tsx`, `src/components/Navbar.tsx`, `src/i18n/appBase.ts`

### Post-login opens dashboard
**Goal:** After login, land on the role dashboard instead of appointments.

- User → `/user/dashboard`, coach → `/mentor/dashboard`, admin → `/admin` (unchanged)
- Key path: `src/lib/postLoginRedirect.ts`

## 2026-09-07

### Chat i18n overrides (9 locales)
**Goal:** Full non-English translations for chat inbox, session, and call panel UI.

- Added `chatOverrides.ts` with complete `chatInbox` (17), `chatSession` (100), and `chatCallPanel` (52) keys for nl, fr, de, es, it, ar, zh, ru, ro
- Key paths: `src/i18n/chatOverrides.ts`

### Admin dashboard — home page without logout
**Goal:** Let admins open the public home page from the console without ending their admin session.

- Added “View website” link (`/`) in admin sidebar footer and header (same pattern as coach dashboard)
- i18n: `viewWebsite` / `viewWebsiteHint` under `dashboardAdmin`
- Key paths: `src/components/dashboard/AdminDashboardLayout.tsx`, `src/i18n/appBase.ts`, `src/i18n/adminDashboardOverrides.ts`

### Chat + live session — full 10-language i18n
**Goal:** Selecting a UI language localizes the entire chat / live session experience (inbox, session chrome, extend/pay dialogs, meeting panel).

- Added `chatInbox` + `chatSession` namespaces and expanded `chatCallPanel` in `src/i18n/appBase.ts`
- New `src/i18n/chatOverrides.ts` with complete translations for nl, fr, de, es, it, ar, zh, ru, ro; wired via `appOverrides.ts`
- Wired components: `ChatInboxPage`, `ChatInboxList`, `ChatSessionPage`, `ChatPanel`, `ConnectionStatusBar`, `SessionExtendDialog`, `SessionExpiryWarningDialog`, `MeetingPanel`

### Manual wallet refund — coach no-show (info@mijnlevenspad.com)
**Goal:** Return €10 for two paid sessions the coach never joined.

- User `info@mijnlevenspad.com` had two unattended mentor no-show bookings (€5 wallet + €5 card), no prior refunds
- Ran `refund_booking_to_user_wallet_direct` for both; wallet balance `0.00` → `10.00`
- Bookings: `c5a7289a-…`, `387dce8c-…` (coach Anke Dewla)

### Local frontend + backend wiring
**Goal:** Run SPA against local FastAPI.

- Pointed root `.env` `VITE_API_URL` to empty (Vite proxies `/api` → `127.0.0.1:8001`)
- Fixed backend startup crash: missing `Any` import in `backend/api/v1/chat.py`
- Fixed PowerShell quoting in `scripts/start-backend.ps1`

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
