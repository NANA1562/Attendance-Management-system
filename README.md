# Clockwise — Staff Attendance & Workforce Management (MVP)

Multi-business staff attendance and daily tasks for small businesses. Staff clock in on a shared tablet with a staff ID + PIN; seniors see attendance and task progress on a dashboard.

**Stack:** Next.js 16 (App Router, server actions) · TypeScript · Tailwind · Postgres on Supabase · Drizzle ORM · Vitest

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, DIRECT_URL, DB_PASSWORD, SESSION_SECRET
npm run db:migrate           # creates the 15 tables
npm run db:seed              # optional demo business
npm run dev                  # http://localhost:3000
```

Supabase: **Connect → Connection string**. Use the *Transaction pooler* string (port 6543) for `DATABASE_URL` and the *Session pooler* (port 5432) for `DIRECT_URL`, without the password. Put the database password in `DB_PASSWORD`.

### Demo logins (after `db:seed`)

Business code **DEMO22**

| Staff ID | Name | Level / role | PIN |
|---|---|---|---|
| 1001 | Akosua Mensah | Senior · Supervisor (password `demo-pass-2026`) | 1234 |
| 1002 | Michael Owusu | Junior · Store Assistant | 2222 |
| 1003 | Ama Asante | Junior · Cashier | 3333 |
| 1004 | Kofi Adjei | Junior · Store Assistant (Tue–Sat 09–18) | 4444 |

### Demo flow

Create business (`/setup`) → add staff → set schedule → tablet (`/kiosk`): staff ID + PIN → **Clock in** (status calculated) → break → **Clock out** (hours calculated) → manager dashboard (`/manage`) shows it, plus each person's tasks.

## Features

- **Clock-in tablet** (`/kiosk`): staff ID + PIN keypad with lockout; the day as three steps (clock in → break → clock out); late reason; today's checklist. A small photo is taken at clock-in and clock-out so staff can't clock in for each other (can be switched off in Settings).
- **Today** (`/manage`): present / on time / late / absent with change vs the previous working day, 14-day attendance trend, punctuality leaderboard, shift timeline, needs-attention list, task progress, detail table with tap photos.
- **Rota** (`/manage/rota`): everyone's week in one grid. Click a day to change just that day (different hours or a day off) without touching the weekly pattern; "Usual" puts it back.
- **Payroll export** (`/manage/reports`): this/last week, this/last month or custom dates. Per-person days, lateness, absences, leave, hours, overtime, undertime and missing clock-outs, with **CSV downloads** (summary and day-by-day) that open in Excel/Sheets.
- **Tasks** (`/manage/tasks`): today's kanban board and role/person templates with subtasks.
- **Staff, Roles, Settings**: staff profiles with schedules, leave, PIN reset and 14-day history; job roles; per-business rules.

## How it's built

| Path | What |
|---|---|
| `src/db/schema.ts` | All 15 tables (8 attendance + 7 roles/activities/tasks). Every table carries `business_id`. |
| `src/lib/attendance/engine.ts` | **The attendance engine** — pure functions, fully unit tested. Schedule + leave + taps → status, hours, overtime. |
| `src/lib/tasks/due.ts` | Which task templates land on which day. |
| `src/server/` | Database access: login/lockout, recording taps, dashboard data, task generation. |
| `src/app/kiosk` | Shared tablet: keypad, clock in/out/break, my tasks. |
| `src/app/manage` | Senior dashboard: today, staff, schedules, leave, roles, tasks, settings. |
| `drizzle/` | SQL migrations. `0001` enables RLS so Supabase's public REST API can't reach the data. |

`npm test` runs the engine tests (Baffour's 8 Day-3 scenarios plus thresholds, half days, breaks and timezones).

## Rules (as built)

**Arrival status**, measured from the scheduled start (configurable per business in Settings):

| Minutes after start | Status |
|---|---|
| 0 or early | On time |
| 1–35 | Grace |
| 36–70 | Late |
| 71+ (including after 2 h) | Attendance risk |
| No clock-in by 2 h | Absent |
| Preset off day / no schedule | Off day (clocking in → Worked on off day) |
| Approved full-day leave | On leave |

**Hours worked** = clock-out − clock-in − *max(actual break, break allowance)*. The allowance (default 60 min per shift) applies once someone has worked at least half their shift, so skipping lunch doesn't create overtime, and a longer break costs hours. Someone who leaves before half their shift (e.g. sent home sick) only has breaks they actually took deducted.
**Overtime / undertime** = hours worked vs expected (shift length − allowance). Early departure is recorded separately.
**Half-day leave** splits the shift at its midpoint; lateness and hours are measured against the adjusted times; no break allowance.

## Decisions changed from the design docs

- **PINs are hashed**, not stored readable. A senior resets a PIN and sees the new one once.
- **Clocking in after the 2-hour cutoff = Attendance risk** (with minutes late), not Absent. Absent means never clocked in.
- `job_title` dropped in favour of `role_id`; `day_of_week` is 0–6; both subtask tables carry `business_id`.
- Absent/off/leave days are **worked out live** from schedules instead of written by a nightly job. Same answer, no cron to run for the MVP.
- Login uses signed HTTP-only cookies, not Supabase Auth (no email accounts).
- No schedule row for a day is treated as an off day.

## Not in the MVP yet

Activities UI (tables exist), manager corrections for wrong/missing taps (void + replace), offline tablet sync, WhatsApp alerts, GPS. Tap photos are kept in Postgres; a retention clean-up (e.g. delete after 90 days) should come before wide use.
