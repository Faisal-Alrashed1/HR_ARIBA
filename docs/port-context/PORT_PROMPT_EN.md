# ARIBA HR — Porting prompt (React system → our system)

> Prompt for a new Claude Code session, written 2026-10-18. Paste everything below the line into the new session.
> The session must be opened on `~/Desktop/HR`, with access to `~/Desktop/مشروع الموارد البشرية`, `~/Desktop` and `~/Downloads`.

---

You are continuing the ARIBA HR project. You know nothing about it yet, so start by reading.

## Rules (mandatory for the whole job)
- Reply to me in Arabic, short and direct.
- No push to main and no deploy until I say «انشر». A push to main deploys production and demo together.
- Never delete any file, database, environment or backup. The only approved deletion: all logic that exists in our system but not in theirs (🟣), with no exceptions.
- Their project folder `~/Desktop/مشروع الموارد البشرية/React` is read-only: do not edit it, and never run npm install or a build inside it.
- I run every change to the Railway database myself from the terminal; you prepare the command.
- No real passwords on the deployed sites, and never commit files that contain real data.
- Work on a new branch `feature/hr-react-port` from main, and do not push it.
- After each task: a short summary of what was done, what was not, and the checks with their results. Then stop and wait for my approval.

## The decision
- Our system is the base: our stack (FastAPI, Next.js 16, Expo), our normalized schema, our data and our way of working.
- We take everything from their system (features, screens, formulas) and put it into ours.
- We do not copy their technical approach: no direct browser-to-database calls, no calculations in the browser, no PWA.
- Matching rules, from the colored comparison file:
  - 🟢 Identical: stays exactly as it is.
  - 🟠 Nearly identical or 🔴 Different: change our code to match their formula exactly. Do not rely on our logic.
  - 🟣 Ours only: delete, with no exceptions.
  - 🔵 Theirs only: add.
- New features and screens are built exactly like their website and app: same screens, fields, texts, order and behaviour, working for real in our website and app.
- Build everything completely and verify it completely before any deploy.

---

## Task 0 — Read and understand (no changes)
Read in this order:
1. `~/Desktop/HR/ARIBA_MASTER_CONTEXT.md`, in full. It is the main reference.
2. `~/Desktop/HR/HR_ARIBA/docs/PROJECT_GUIDE.md`, `docs/LOGIC_AUDIT.md`, `docs/DATABASE.md` and `frontend/hr-web/AGENTS.md`.
3. `~/Desktop/HR/مقارنة_المعادلات.xlsx` (all 188 rows) and `~/Desktop/HR/مقارنة_المعادلات.md`.
4. All of their code: `ARIBA_HR_React/src`, `ARIBA_Employee_React/src`, `sql/10–20`, `supabase/functions` and `docs/`.
5. The deployment guides `~/Desktop/Ariba_HR_Deployment_Guide.docx` and `~/Desktop/ARIBA_Employee_Deployment_Guide.docx` (read them with `textutil -convert txt -stdout`).
6. The final report `~/Desktop/تقرير_مشروع_أريبا_للموارد_البشرية_النهائي.pdf` is already summarised in section 9.5.1 of the context file (its text was extracted on 18 October). Read that section; you do not need to open the PDF itself.
7. Check the state: `git status` and `git log -3` in `~/Desktop/HR/HR_ARIBA`. The latest commit should be `494998d`.

Output: your understanding in 15 lines, any feature or formula in the PDF report that is missing from the comparison file, and your questions. Then stop.

## Task 1 — Full inventory and porting plan (documentation only)
1. Write `docs/PORT_PLAN.md` in our repo, containing:
   - Every row of the comparison file (188) with its action — keep / change to match theirs / delete / add — and the files that will change on our side.
   - Every screen of theirs on the website (every page in `pages/` and `components/`) and in the app (every file in `employee/`), with our equivalent or "new".
   - Every one of the 119 functions, with our backend equivalent (API route) or "new".
   - Every new table and setting they need, and how it fits our normalized schema.
   - The extra features from the PDF report.
2. Write the deletion list (🟣) separately, for the record: every item and its impact. Deletion is already approved; do not wait for approval.
3. Write the list of the 6 missing functions and what you will build in their place, based on what their screens expect.
4. Split the work into small phases, each one testable on its own.

Output: the file and your questions. Stop and wait for my approval of the plan.

## Task 2 — Parity tool against their formulas
1. Copy their pure formulas (`engines/*`, `lib/schedule.js`, `lib/tafqeet.js` and the calculation functions in `pages/finance/*`) into `tools/react-parity/reference/` in our repo, as a read-only reference like `frontend/legacy`.
2. Build tests that run their formulas and ours on the same inputs: thousands of random cases from a fixed seed, plus edge cases. Cover:
   - Payroll (every column from A to AW).
   - GOSI.
   - End of service and settlement.
   - Leave (our Python formulas run through a script).
   - Attendance and amounts in words (tafqeet).
   - The new calculators.
3. Run them now and save the result. It must show the same differences as the comparison file.

Output: the tool and its result. Stop.

## Task 3 — Match the differing formulas (🟠 and 🔴)
For every orange or red row: change our code (backend, website and app) to give exactly the same result as their formula. Examples:
- The leave accrual method, with the `leave_accrual_method` setting; the default is "calendar".
- The carry-over cap from the `leave_carry` setting.
- The end-of-service leave excess counted from the first year.
- Imported `yearEnd` and `current` figures.
- The automatic GOSI rate table.
- Housing fixed at 25% in payroll GOSI.
- noEos for consultants, tamheer and trainees.
- Art. 85 and Art. 77 with their formula.
- The leave balance after 5 years with their formula.
- The V142 alerts.
- Days left with rounding.
- And every other row.

Update the old tests (pytest and `tools/legacy-parity`) that asserted our corrections so they assert their formula, and write the reason in `docs/LOGIC_AUDIT.md`.

Output: the parity tool shows zero differences on everything shared, and all checks pass. Stop.

## Task 4 — Delete what only we have (🟣)
Delete all logic that exists in our system and not in theirs, with no exceptions, so the behaviour becomes exactly like theirs. This includes:
- The labour-law corrections A to K.
- The login lockout after failed attempts.
- Automatic contract termination and reactivation.
- The 2024 carry-over rule.
- Freezing a terminated employee's balance.
- The year-end balance in the app.
- Resetting the previous session's early leave.
- The remote-work days counter.
- The labour-law note on requests.
- Any other 🟣 row in the comparison file.

For each item: a test that proves the behaviour now matches theirs. Delete the logic only — no other files and no data. Record every deleted item in `docs/LOGIC_AUDIT.md`. Stop.

## Task 5 — Schema and data
1. Design the new tables and settings on our normalized schema: candidates, invite links, targets, evaluations, delegation, manager permissions, document signing, leave attachments, mail, tasks, assets if missing, and the rest. Correct keys and links, and nothing existing breaks.
2. Write them as migration files in `docs/db-migrations/` with a run script like `run_on_railway.sh`: a verified backup, then the migration, then verification.
3. Test them locally on a copy of `ariba_after2`. Do not touch `ariba_after2` itself.
4. Update `backend/app/models.py`.

Output: the files and a successful local run. Stop.

## Task 6 — Backend (FastAPI)
- Build in our backend an equivalent for every one of their new and changed functions, plus the 6 missing ones, with the same behaviour, permissions, messages and notifications.
- All calculations run on the server, including the employee app's leave balance, instead of a snapshot written by the browser.
- Add:
  - Email sending and email notifications (Resend or SMTP, configured from environment variables).
  - Scheduled jobs: hourly escalation, and sending notifications.
  - Workflow settings.
- With pytest tests for every new route.

Output: the backend and the tests. Stop.

## Task 7 — HR website (Next.js)
Build every screen of theirs that we don't have, and change the existing ones to match theirs: fields, texts, order, buttons, export and print. Run the website locally against the local backend and check every screen in the built-in browser with screenshots. Stop after each group of screens:
- Finance.
- Employees and candidates.
- Leave and team.
- Targets.
- Reports and export.
- Settings.
- Audit log.

## Task 8 — Employee app (Expo)
Build every screen of their app inside our native app, with the same look and behaviour: home, punch, leave of every type, overtime, forgotten punch, salary, my profile, profile-edit and IBAN requests, documents and signing, approvals, delegation, team, targets and evaluation, notifications, work locations. Check on the iOS simulator with screenshots. Stop.

## Task 9 — Public application form
A public page on our website like their `apply.html`: the public link, one-time links, protection, and file upload. An accepted candidate becomes an employee with the next number, and their files move to the employee's documents. Stop.

## Task 10 — Full verification
- All checks: pytest, `tools/legacy-parity`, `tools/react-parity` (zero differences), and tsc and eslint for the website and the app.
- A full scenario locally on the production copy: new employee, punch, every request type with its stages and escalation, a month's payroll, a payslip, a settlement, an accepted candidate, a target and an evaluation, a test email.
- Compare every screen with theirs. Running their version means copying it to the scratchpad and running npm install there, so ask me first.
- Write the verification report in `docs/PORT_VERIFICATION.md`.

Output: the report. Stop.

## Task 11 — Deploy
After Task 10 passes in full, ask me one question: «انشر؟»
If I say «انشر», we deploy the usual way:
1. Give me the database migration commands (demo, then production) in the same way as `run_on_railway.sh`, and I run them.
2. After the migration succeeds: merge the branch into main and push, which deploys production and demo together.
3. Confirm both backends started without errors, and update `docs/PROJECT_GUIDE.md` and `ARIBA_MASTER_CONTEXT.md`.

Start now with Task 0 only.
