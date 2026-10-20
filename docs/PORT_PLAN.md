# Port Plan — خطة النقل

# English

## Plan for Porting the React System to Our System (ARIBA HR)

> Written 2026-10-18 on branch `feature/hr-react-port` (from `main` at `494998d`).
> Reference: `~/Desktop/HR/مقارنة_المعادلات.xlsx` (188 rows), the HR department's code in `~/Desktop/مشروع الموارد البشرية/React` (read-only), `ARIBA_MASTER_CONTEXT.md`.
> Rule: our system is the foundation (FastAPI + Next.js 16 + Expo + the organized Railway schema). We port their features, formulas and screens, not their technical approach: no browser-to-database connection, no final calculations in the browser, and no PWA.

### 0. Legend
- Rows: 🟢 stays · 🟠/🔴 modified to match their formula · 🟣 removed · 🔵 added.
- Functions: ✅ exists on our side · ✏️ exists and gets modified · 🆕 new · ✖ not ported (replaced by our approach).
- All paths are under `/api/v1`.

### 1. Approved decisions (from the prompt, not to be revisited)
1. Rows 113 and 142 are not removed: they are modified to match their app screen (`Home.jsx`: "Year-end balance" and "Remote remaining" = `remote_days_per_year − remoteDaysUsed`, default 10) and the company card "Remote work limit".
2. Row 66: automatic termination at contract end is removed. Their behavior is ported: saving a terminated employee whose fixed-term contract has not ended ← returns them to active, plus a "Reactivate" button in the list.
3. What they store in the browser moves to the server (`ariba_app_settings`): master lists, report templates, the salary certificate outgoing-number counter, ID issue place. The employee's signature stays on their device only (`expo-secure-store` / browser), and the server receives the document after the signature is merged.
4. Leave balance in the app and the manager's team is computed by the server with the same engine and the selected method (`leave_accrual_method`). No snapshots.
5. Mail passwords are encrypted (AES-GCM, key `MAIL_SECRET_KEY` in environment variables).
6. Email: SMTP, Resend and Microsoft Graph, with PDF attachments.
7. Calculations happen on the server, or in `lib/calc` on the website for instant display. The final reference is the server's result, using their same formula.
8. Unpaid leave deduction and salary advance in the payroll are manual, like theirs.
9. Their defects are not ported: the audit log from the browser, the bell every 3 seconds, `sw.js`, settings hard-coded in the code.

### 2. New structure in our server
| File | Content |
|---|---|
| `backend/app/routers/canonical.py` | Stays (current routes) with the modifications |
| `backend/app/routers/port_workflow.py` | New request workflow: new types, return, rejection with reason, escalation, deadline settings, delegation, manager permissions, submitting on behalf, team requests |
| `backend/app/routers/port_candidates.py` | Candidates and links + the public routes `/public/apply*` |
| `backend/app/routers/port_goals.py` | Targets and evaluation |
| `backend/app/routers/port_docs.py` | Document signing, leave attachments |
| `backend/app/routers/port_mail.py` | Mail accounts, sending a document/report, messages |
| `backend/app/routers/port_tasks.py` | Team availability, tasks and meetings |
| `backend/app/routers/port_assets.py` | Assets and custody |
| `backend/app/routers/port_audit.py` | Audit log and month-deletion requests |
| `backend/app/routers/port_settings.py` | New settings (kv, permissions, roles, Ramadan, branding, country…) + `/public/brand` + password recovery + color extraction |
| `backend/app/routers/port_ai.py` | The assistant: command parsing on the server + execution after confirmation |
| `backend/app/services/port_*.py` | Logic: workflow2, mailer, crypto, scheduler, schedule (working hours/Ramadan), country (Egypt), audit, tasks |
| `backend/app/services/scheduler.py` | Scheduled jobs inside the server (asyncio): escalation every hour, email flush every 5 minutes, automatic candidate registration every minute |

### 3. New tables and settings (Task 5)
| Table | Keys and relations | Their counterpart |
|---|---|---|
| `ariba_candidates` | PK id uuid · `employee_id` FK → employee_directory (SET NULL) | Same |
| `ariba_candidate_files` | PK · `candidate_id` FK → ariba_candidates (CASCADE) | Same |
| `ariba_candidate_invites` | PK token · `candidate_id` FK (SET NULL) | Same |
| `ariba_targets` | PK · `employee_id` FK → employee_directory | Same |
| `ariba_evaluations` | PK · UNIQUE(employee_id, period_type, period_key) · FK | Same |
| `ariba_delegations` | PK employee_id FK · `manager_id` FK | Same |
| `ariba_manager_perms` | PK manager_id FK | Same |
| `ariba_doc_signing` | PK request_id · `document_id` FK → ariba_documents (CASCADE) · employee/manager FK | Same |
| `ariba_leave_files` | PK · `employee_id` FK · `leave_id` text (request number) | Same |
| `ariba_mail_accounts` | PK owner (`company` or employee number) · `password_enc` bytea instead of text | Same + encryption |
| `ariba_tasks` | PK · `created_by` FK · kind task/meeting · title, notes, due_at, starts_at, ends_at, location, status | New (the file `5_run_in_SQL_Editor_team_tasks_and_fixes.sql` was not delivered) |
| `ariba_task_assignees` | PK(task_id, employee_id) · FKs · status pending/accepted/declined/done · reason | New |
| `ariba_audit_purge_requests` | Exists on our side | Exists |
| `ariba_assets`, `ariba_asset_custody_log` | Both exist on our side | Exists |
| `ariba_webauthn_credentials` | PK · account_id FK → ariba_auth_accounts · credential_id, public_key, sign_count | New (fingerprint login on the website) |
| `ariba_push_tokens` | PK token · account_id FK | New (Push for the app) |
| `workflow_notifications` | + `emailed_at`, `email_error`, `email_tries` | Same |

**Settings (`ariba_app_settings`):** `workflow_config`, `doc_sign_cfg`, `leave_accrual_method`, `leave_carry`, `attendance_schedule`, `country_system`, `brand_colors`, `punch_watermark`, `letterhead`, `hr_signer`, `candidate_auto`, `apply_public_url`, `master_lists`, `report_templates`, `salary_cert_seq`, `id_issue_place`, `ins_settings`, `perms_matrix`. **(`ariba_security_flags`):** `apply_form_key`, `apply_invite_only`, `apply_invite_hours`. **(`company_settings`/attendance):** `ramadan_flex_enabled`, `ramadan_window_start/end`, `ramadan_shift_hours`, `ramadan_from/to`, `remote_days_per_year`.

### 4. Removal list 🟣 (Task 4)
| Row | Item | Action |
|---|---|---|
| 66 | Automatic termination at contract end | Removed — **and added**: reactivation on save + a "Reactivate" button (decision 2) |
| 70, 82 | Art. 87 (correction D) | Removed from the page, the settlement and the payroll |
| 72 | Art. 77 for fixed-term contracts (correction C) | Removed — treated like open-ended |
| 100 | 2024 carry-forward rule | Removed |
| 113 | Year-end balance in the app | **Not removed** — modified (decision 1) |
| 114 | Freezing a terminated employee's balance | Removed |
| 137 | Clearing the previous session's check-out (K) | Removed |
| 142 | Remote work counter | **Not removed** — modified (decision 1) |
| 153 | Labor law notice on requests (E/F) | Removed |
| 188 | Login lockout after failed attempts | Removed |
| — | Corrections A, B, G, J, K, I (removed within their 🔴 rows by matching their formula) | 20/69/81, 74, 25–27, 12, 136, holidays notice I |

### 5. The six gaps (built from their screens' behavior)
1. `ariba_team_availability` → `GET /team/availability`: merging consecutive leaves, "upcoming leave" within 14 days, "returns to work" = first working day after the leave.
2. `ariba_my_tasks` / `ariba_send_task` / `ariba_task_update` → `/tasks`: task or meeting, a warning if an invitee is on leave, done/accept/decline with reason/cancel.
3. `ariba_hr_set_ramadan_flex` → `PUT /settings/attendance/ramadan`, read by `GET /settings/attendance` (+ `is_ramadan_today`).
4. `ariba_get_brand` → `GET /public/brand` (company colors + punch logo).
5. `ariba-password-recovery` → `POST /auth/password-recovery` (username or iqama number, temporary password to the registered email).
6. `ariba-brand-colors` → `POST /settings/brand/extract` (colors from the company website URL).

### 6. Additions from the report and the code (🔵 outside the comparison file)
- Ariba AI assistant (understands colloquial Arabic, opens pages, statistics, attendance, leave, message, password reset, form/settlement/payslip, confirmation before execution) → `services/port_ai.py` (porting `aiParse.js` to Python) + `components/hr/ai-assistant.tsx`.
- Fingerprint / Face ID: the app uses `expo-local-authentication` + "Remember me" and "Forget this device"; the website uses WebAuthn (`ariba_webauthn_credentials`).
- Deleting a month older than 30 days from the audit log via a request to Finance (approve/reject).
- Importing employees from Excel/CSV with column mapping, preview, template, and updating existing ones (V139).
- Arabic/English with direction, dark mode, Ariba colors as variables (partially exists, to be completed).
- Notification bell with a counter: the website refreshes every 20 seconds; the app uses Push + refresh on open.
- Fallback when sending fails: download PDF + open Outlook (desktop `mailto:` or web), a per-device setting.
- Settings in 9 numbered sections with search, 24 cards.
- 10 Arabic/English documents (`<!--ARIBA_EN-->`), job offer, outgoing number `AR-YYYYMMDD-n` + Hijri, bulk sending, single-page A4 PDF (scaling down to 1.35).
- Automatic candidate registration (`candidate_auto`) as a scheduled job.
- Payroll path: HR preparation ← Finance approval ← reopening with a reason ≥ 5 characters, autosave, syncing others' edits.
- Assets and custody: straight-line depreciation, default useful lives, non-capital, annual inventory, custody tab in the employee file.
- Allowance as a percentage (`allowModes`), dependents with their attachments, "Restore" for each field.
- Custom report builder + templates saved on the server + "Export page" (Excel/PDF/Word/email).
- Yearly balances editor (yearEnd/current/carryNext/eos manual) + log of the last 10 saves + "Undo last save".

### 7. Phases (each phase is a commit and tested on its own)
| Phase | Content | Test |
|---|---|---|
| P1 | This plan | — |
| P2 | `tools/react-parity` (reference + generator + TS/Python comparison) | Shows the same differences as the comparison file |
| P3a | PAYX + payroll rows (N, resignation, noEos, G, external consultant, legacy overtime, Egypt) | react-parity zero in PAYX |
| P3b | Social insurance (automatic table) + employee data + end of service + settlement | react-parity zero |
| P3c | Leave engine (the three methods, carry-forward, imported, INTERRUPT, surplus) | react-parity zero + pytest |
| P3d | Attendance (schedule and Ramadan, absentees), dashboard and alerts, reports, 113/142 | pytest |
| P4 | 🟣 removals + a test for each item | pytest + updated legacy-parity |
| P5 | Schema migration `docs/db-migrations/` + trial on a copy of `ariba_after2` | Verification script |
| P6a–f | Server: request workflow, candidates, targets, documents and signing, mail and scheduler, tasks, assets, audit log, settings, assistant | pytest for each route |
| P7a–h | Website: finance, employees and candidates, leaves and team, targets, reports, settings, audit log, assistant | Local browsing + screenshots |
| P8 | The app: all screens | iOS simulator + screenshots |
| P9 | Public application form `/apply` | pytest + browsing |
| P10 | Full verification `docs/PORT_VERIFICATION.md` | All checks |

### 8. Screens: theirs ← ours
#### 8.1 HR program (ARIBA_HR_React/src)
| Their file | Screen | Ours (`frontend/hr-web/src/app/(hr)/(portal)/…`) |
|---|---|---|
| pages/Dashboard.jsx | Dashboard | `dashboard/page.tsx` (modified: V142 alerts, salaries by work entity) |
| pages/employees/index.jsx, EmpList.jsx | Employees (lists: current, Saudis, residents, consultants, excluded, by project) | `employees/page.tsx` (+ "Reactivate" button, import) |
| pages/employees/EmpForm.jsx | Employee form | `employees/new`, `employees/[id]` + `components/hr/employee-form.tsx` (+ allowance as percentage, restore per field, dependents) |
| pages/employees/EmpDetails.jsx | Employee details | `components/hr/employee-details.tsx` |
| pages/employees/EmpCustody.jsx | Custody tab | **New** `components/hr/employee-custody.tsx` |
| pages/employees/EmpDocsBox.jsx | Employee documents | `employee-details.tsx` (exists) |
| pages/employees/Import.jsx | Excel/CSV import | **New** `employees/import/page.tsx` |
| pages/employees/PwReset.jsx | Password reset | `components/common/password-dialog.tsx` (exists) |
| pages/candidates/index.jsx | Candidates | **New** `candidates/page.tsx` |
| pages/candidates/Invites.jsx | Application links | **New** `candidates/invites` (tab) |
| pages/goals/index.jsx + goals/TargetsEditor.jsx, PeriodPick.jsx | Targets | **New** `goals/page.tsx` |
| pages/goals/Eval.jsx + goals/EvalForm.jsx | Evaluation | **New** `evaluation/page.tsx` |
| pages/attendance/index.jsx | Attendance | `attendance/page.tsx` (modified: absentees, schedule and Ramadan) |
| pages/attendance/Locations.jsx | Punch locations | `locations/page.tsx` (exists) |
| pages/leaves/index.jsx | Leaves and requests (tabs) | `leaves/page.tsx` |
| pages/leaves/Pending.jsx | Pending requests (on behalf, final, rejection with reason, return, escalation) | `leaves/page.tsx` (modified) |
| pages/leaves/AllRequests.jsx | All requests | `leaves/page.tsx` (exists) |
| pages/leaves/Balances.jsx | Balances editor | `leaves/page.tsx` balances tab (modified: automatic current, log of 10, undo) |
| pages/leaves/NewRequest.jsx | New request from HR | `leaves/page.tsx` (modified: overlapWithAnnual, the new types) |
| pages/leaves/Overtime.jsx | Overtime (HR) | `leaves/page.tsx` (exists) |
| pages/leaves/Holidays.jsx | Public holidays | `leaves/page.tsx` (exists) |
| pages/team/index.jsx | Team availability and tasks | **New** `team/page.tsx` |
| pages/payroll/index.jsx, cols.jsx, output.js | Payroll | `payroll/page.tsx` (modified: prepare/approve/reopen, autosave, sync) |
| pages/payroll/Archive.jsx | Payroll archive | `payroll/page.tsx` (exists) |
| pages/finance/InsCalc.jsx | Social insurance calculator + GOSI file | **New** `insurance-calculator/page.tsx` |
| pages/finance/SalCalc.jsx | Salary calculator + job offer | **New** `salary-calculator/page.tsx` |
| pages/finance/TaxCalc.jsx | Tax calculator | **New** `tax-calculator/page.tsx` |
| pages/finance/Wps.jsx | Salary transfer file | **New** `wps/page.tsx` |
| pages/finance/Prov.jsx | Provisions report | **New** `provisions/page.tsx` |
| pages/finance/Assets.jsx | Assets and custody | **New** `assets/page.tsx` |
| pages/finance/Slip.jsx | Payslip | `payslips/page.tsx` (modified) |
| pages/finance/Eos.jsx | End of service | `end-of-service/page.tsx` (modified) |
| pages/finance/EosCalc.jsx | Settlement | `settlement/page.tsx` (modified) |
| pages/docs/index.jsx | Documents | `documents/page.tsx` |
| pages/reports/index.jsx | Reports | `reports/page.tsx` |
| pages/reports/CustomReport.jsx | Report builder | **New** `reports/custom` (tab) |
| pages/settings/index.jsx + 22 cards + shared.jsx | Settings (9 sections, 24 cards, search) | `settings/page.tsx` (reorganized + the new cards) |
| pages/audit/index.jsx, SectionAudit.jsx, PurgeBox.jsx | Audit log + month deletion | **New** `audit/page.tsx` |
| pages/forms/index.jsx, docs.js, formsEn.js, salaryCert.js, extraCards.jsx | Forms (10 documents, bulk sending) | `templates/page.tsx` + `lib/calc/forms*.ts` (modified) |
| components/AiAssistant.jsx (+ lib/aiParse.js, aiBridge.js) | The assistant | **New** `components/hr/ai-assistant.tsx` |
| components/HrBell.jsx | Notification bell | **New** `components/hr/hr-bell.tsx` |
| components/PageExport.jsx, ExportDialog.jsx | Page export | **New** `components/hr/page-export.tsx` |
| components/Login.jsx, BioAsk.jsx | Login + forgot password + fingerprint | `(hr)/login/page.tsx` (modified) |
| components/IdleGuard.jsx | Idle 5 + 3 minutes | **New** `components/hr/idle-guard.tsx` |
| components/CandAuto.jsx | Automatic candidate registration | **On the server** (scheduled job) |
| components/DocPreview.jsx, Modal, PromptModal, Toast, ChartCanvas, Layout | Shared components | Exist on our side (`modal.tsx`, `toast.tsx`, `charts.tsx`, `hr-shell.tsx`) |
| pages/Soon.jsx, registry.js | Page registration | `lib/routes.ts` |
| apply/ApplyApp.jsx | Public application form | **New** `src/app/apply/page.tsx` (outside the portal) |

#### 8.2 Employee app (ARIBA_Employee_React/src/employee)
| Their file | Screen | Ours (`frontend/employee-app/…`) |
|---|---|---|
| Home.jsx + punch.jsx | Home: punch, progress ring, 3 tiles, quick actions | `app/(tabs)/index.tsx` (modified) |
| Att.jsx | Attendance (31 days + period) | `app/(tabs)/attendance.tsx` |
| ForgotPunch.jsx | Forgotten punch | `attendance.tsx` (exists, to be matched) |
| Leaves.jsx + liveLeave.js | Leaves (unpaid, salary advance, permissions) | `app/(tabs)/leaves.tsx` (modified) |
| Overtime.jsx | Overtime | `app/(tabs)/overtime.tsx` |
| Pay.jsx | Salary and PDF payslip | `app/(tabs)/salary.tsx` (+ PDF) |
| Prof.jsx + ProfileRequests.jsx | My profile, data edit, IBAN change, document upload | `app/(tabs)/profile.tsx` (modified) + **New** `app/profile-edit.tsx`, `app/iban-change.tsx`, `app/upload-document.tsx` |
| Docs.jsx + SigManager.jsx | Documents and signing | `app/(tabs)/documents.tsx` + `app/letter/[id].tsx` (+ signing) |
| MgrSignDocs.jsx | Manager signing | **New** `app/manager-sign.tsx` |
| Approvals.jsx | Approvals | `app/(tabs)/approvals.tsx` (modified) |
| Delegation.jsx | Delegation | **New** `app/delegation.tsx` |
| Team.jsx + MgrTeam.jsx | My team + submitting on behalf + tasks | `app/(tabs)/team.tsx` (modified) + **New** `app/submit-for.tsx`, `app/tasks.tsx` |
| goals/MyGoals.jsx | My goals and my evaluation | **New** `app/(tabs)/goals.tsx` |
| Bell.jsx | Notifications | `src/lib/notifications.tsx` (exists) + Push |
| WorkLocations.jsx | Work locations | **New** `app/work-locations.tsx` |
| EmpLogin.jsx + ChangePw.jsx | Login + Face ID + mandatory change | `app/login.tsx`, `app/change-password.tsx` (modified) |
| theme.js, brand.js, nav.jsx, EmpApp.jsx, EmpStore.jsx | Theme, branding, tabs, state | `src/theme.tsx`, `src/lib/data.tsx`, `app/(tabs)/_layout.tsx` |


### 9. Functions (119 + 3 public) ← our server routes
| # | Function | Status | Counterpart in our server |
|---|---|---|---|
| 1 | `ariba_asset_custody` | 🆕 | `GET/POST /assets/{id}/custody` |
| 2 | `ariba_assets_delete` | 🆕 | `DELETE /assets/{id}` |
| 3 | `ariba_assets_list` | 🆕 | `GET /assets` |
| 4 | `ariba_assets_upsert` | 🆕 | `POST/PUT /assets` |
| 5 | `ariba_attendance` | ✅ | `POST /me/attendance/punch (+ flexible Ramadan)` |
| 6 | `ariba_audit_add_many` | ✖ not ported | The server writes the log itself in every route (decision 9) |
| 7 | `ariba_audit_list` | 🆕 | `GET /audit` |
| 8 | `ariba_audit_purge_decide` | 🆕 | `POST /audit/purge/{id}/decide` |
| 9 | `ariba_audit_purge_info` | 🆕 | `GET /audit/purge` |
| 10 | `ariba_audit_purge_request` | 🆕 | `POST /audit/purge` |
| 11 | `ariba_change_my_password` | ✅ | `POST /auth/change-password` |
| 12 | `ariba_company_public` | ✅ | `GET /settings/company (+ /public/company for the app)` |
| 13 | `ariba_delete_location` | ✅ | `DELETE /locations/{id}` |
| 14 | `ariba_delete_request` | ✅ | `DELETE /me/requests/{id}` |
| 15 | `ariba_doc_employee_sign` | 🆕 | `POST /me/letters/{id}/sign` |
| 16 | `ariba_doc_manager_pending` | 🆕 | `GET /me/sign/pending` |
| 17 | `ariba_doc_manager_sign` | 🆕 | `POST /me/sign/{request_id}` |
| 18 | `ariba_doc_my_states` | 🆕 | `GET /me/sign/states` |
| 19 | `ariba_doc_sign_cfg_get` | 🆕 | `GET /settings/doc-sign` |
| 20 | `ariba_doc_sign_cfg_set` | 🆕 | `PUT /settings/doc-sign` |
| 21 | `ariba_employee_ack_template` | ✅ | `POST /me/letters/{id}/respond` |
| 22 | `ariba_employee_context` | ✅ | `GET /me + /me/employee` |
| 23 | `ariba_employee_pending_templates` | ✅ | `GET /me/letters` |
| 24 | `ariba_eval_approve` | 🆕 | `POST /evaluations/{id}/approve` |
| 25 | `ariba_eval_get` | 🆕 | `GET /evaluations/{emp}/{type}/{key}` |
| 26 | `ariba_eval_list` | 🆕 | `GET /evaluations` |
| 27 | `ariba_eval_save` | 🆕 | `PUT /evaluations/{emp}/{type}/{key}` |
| 28 | `ariba_get_attendance_settings` | ✏️ | `GET /settings/attendance (+ Ramadan fields, remote_days_per_year)` |
| 29 | `ariba_get_brand` | 🆕 gap | `GET /public/brand` |
| 30 | `ariba_get_document` | ✅ | `GET /documents/{id}/file` |
| 31 | `ariba_hr_apply_key_rotate` | 🆕 | `POST /candidates/apply-key/rotate` |
| 32 | `ariba_hr_apply_mode_set` | 🆕 | `PUT /candidates/apply-mode` |
| 33 | `ariba_hr_attendance_range` | ✅ | `GET /attendance/range` |
| 34 | `ariba_hr_candidate_accept` | 🆕 | `POST /candidates/{id}/accept` |
| 35 | `ariba_hr_candidate_by_ref` | 🆕 | `GET /candidates/by-ref/{ref}` |
| 36 | `ariba_hr_candidate_file` | 🆕 | `GET /candidates/files/{id}` |
| 37 | `ariba_hr_candidate_reject` | 🆕 | `POST /candidates/{id}/reject` |
| 38 | `ariba_hr_candidates` | 🆕 | `GET /candidates` |
| 39 | `ariba_hr_default_password_list` | 🆕 | `GET /auth/users/default-passwords` |
| 40 | `ariba_hr_delete_employee` | 🆕 | `DELETE /employees/{id} (archived in ariba_deleted_items)` |
| 41 | `ariba_hr_delete_leave` | ✅ | `DELETE /requests/{id}` |
| 42 | `ariba_hr_final_approve` | ✅ | `POST /requests/{id}/final-approve` |
| 43 | `ariba_hr_get_setting` | 🆕 | `GET /settings/kv/{key}` |
| 44 | `ariba_hr_get_wf_config` | 🆕 | `GET /settings/workflow` |
| 45 | `ariba_hr_invite_create` | 🆕 | `POST /candidates/invites` |
| 46 | `ariba_hr_invite_revoke` | 🆕 | `POST /candidates/invites/{token}/revoke` |
| 47 | `ariba_hr_invites` | 🆕 | `GET /candidates/invites` |
| 48 | `ariba_hr_leave_snapshots` | ✖ replaced | The server computes the balance directly (decision 4) — GET /leave/balances |
| 49 | `ariba_hr_leaves_since` | ✅ | `GET /leave/requests` |
| 50 | `ariba_hr_list_roles` | ✅ | `GET /settings/accounts` |
| 51 | `ariba_hr_locations` | ✅ | `GET /locations` |
| 52 | `ariba_hr_manager_perms` | 🆕 | `GET /settings/manager-perms` |
| 53 | `ariba_hr_override_workflow` | ✏️ | `POST /requests/{id}/override (final per type)` |
| 54 | `ariba_hr_record_leave` | ✅ | `POST /requests` |
| 55 | `ariba_hr_reject` | ✏️ | `POST /requests/{id}/reject (mandatory reason)` |
| 56 | `ariba_hr_reset_password` | ✅ | `POST /auth/users/{id}/temporary-password` |
| 57 | `ariba_hr_return_to_manager` | 🆕 | `POST /requests/{id}/return` |
| 58 | `ariba_hr_run_escalation` | 🆕 | `POST /requests/escalate (+ scheduled job every hour)` |
| 59 | `ariba_hr_send_message` | 🆕 | `POST /messages` |
| 60 | `ariba_hr_send_template` | ✅ | `POST /letters` |
| 61 | `ariba_hr_set_attendance_settings` | ✏️ | `PUT /settings/attendance (+ remote_days_per_year)` |
| 62 | `ariba_hr_set_flexible_hours` | ✅ | `PUT /settings/attendance` |
| 63 | `ariba_hr_set_leave_snapshots` | ✖ replaced | No snapshots from the browser (decision 4) |
| 64 | `ariba_hr_set_manager_perms` | 🆕 | `PUT /settings/manager-perms/{manager_id}` |
| 65 | `ariba_hr_set_ramadan_flex` | 🆕 gap | `PUT /settings/attendance/ramadan` |
| 66 | `ariba_hr_set_role` | ✅ | `PATCH /auth/users/{id}` |
| 67 | `ariba_hr_set_setting` | 🆕 | `PUT /settings/kv/{key}` |
| 68 | `ariba_hr_set_wf_config` | 🆕 | `PUT /settings/workflow` |
| 69 | `ariba_hr_submit_overtime` | ✅ | `POST /requests (overtime)` |
| 70 | `ariba_hr_template_status` | ✅ | `GET /letters` |
| 71 | `ariba_hr_terminate_employee` | ✅ | `POST /employees/{id}/terminate` |
| 72 | `ariba_leave_file_delete` | 🆕 | `DELETE /leave-files/{id}` |
| 73 | `ariba_leave_file_get` | 🆕 | `GET /leave-files/{id}` |
| 74 | `ariba_leave_file_list` | 🆕 | `GET /leave-files?leave_id=` |
| 75 | `ariba_leave_file_save` | 🆕 | `POST /leave-files` |
| 76 | `ariba_list_documents` | ✅ | `GET /employees/{id}/documents` |
| 77 | `ariba_mail_delete` | 🆕 | `DELETE /mail/{scope}` |
| 78 | `ariba_mail_get` | 🆕 | `GET /mail/{scope}` |
| 79 | `ariba_mail_set` | 🆕 | `PUT /mail/{scope} (password encrypted)` |
| 80 | `ariba_mark_notifications_read` | ✅ | `POST /me/notifications/read` |
| 81 | `ariba_mgr_my_perms` | 🆕 | `GET /me/manager-perms` |
| 82 | `ariba_mgr_team` | ✏️ | `GET /me/team (per manager permissions)` |
| 83 | `ariba_mgr_team_leave_snapshots` | ✖ replaced | `GET /me/team (balance from the server)` |
| 84 | `ariba_mgr_team_requests` | 🆕 | `GET /me/team/requests` |
| 85 | `ariba_my_attendance_range` | ✅ | `GET /me/attendance/range` |
| 86 | `ariba_my_delegation` | 🆕 | `GET /me/delegation` |
| 87 | `ariba_my_goals` | 🆕 | `GET /me/goals` |
| 88 | `ariba_my_leave_snapshot` | ✏️ | `GET /me/leave (server, same engine and selected method)` |
| 89 | `ariba_my_notifications` | ✅ | `GET /me/notifications` |
| 90 | `ariba_my_tasks` | 🆕 gap | `GET /tasks?box=inbox|sent` |
| 91 | `ariba_password_status` | ✅ | `GET /me (must_change_password)` |
| 92 | `ariba_payroll_archive` | ✅ | `GET /payroll-archive` |
| 93 | `ariba_payroll_draft_get` | ✅ | `GET /sheets/{key}` |
| 94 | `ariba_payroll_prepare` | 🆕 | `POST /sheets/{key}/prepare` |
| 95 | `ariba_payroll_reopen` | ✏️ | `POST /sheets/{key}/unapprove (reason ≥ 5 characters)` |
| 96 | `ariba_payroll_status_get` | ✅ | `GET /sheets/{key}` |
| 97 | `ariba_perms_matrix` | 🆕 | `GET /settings/permissions` |
| 98 | `ariba_perms_set` | 🆕 | `PUT /settings/permissions` |
| 99 | `ariba_save_document` | ✅ | `POST /employees/{id}/documents` |
| 100 | `ariba_send_task` | 🆕 gap | `POST /tasks` |
| 101 | `ariba_set_delegation` | 🆕 | `PUT /me/delegation` |
| 102 | `ariba_staff_attendance` | ✅ | `GET /attendance` |
| 103 | `ariba_staff_employees` | ✅ | `GET /employees` |
| 104 | `ariba_staff_holidays` | ✅ | `GET /holidays` |
| 105 | `ariba_staff_queue` | ✅ | `GET /requests + GET /dashboard` |
| 106 | `ariba_staff_requests` | ✅ | `GET /requests` |
| 107 | `ariba_submit_request` | ✏️ | `POST /me/requests (unpaid, salary_advance, iban_change, profile_edit, document)` |
| 108 | `ariba_submit_request_for` | 🆕 | `POST /me/team/{employee_id}/requests` |
| 109 | `ariba_sync_attendance` | ✅ | `POST/PATCH /attendance` |
| 110 | `ariba_sync_employee` | ✅ | `POST/PATCH /employees` |
| 111 | `ariba_sync_holidays` | ✅ | `POST /holidays` |
| 112 | `ariba_sync_payroll` | ✅ | `PUT /sheets/{key}` |
| 113 | `ariba_target_delete` | 🆕 | `DELETE /targets/{id}` |
| 114 | `ariba_target_save` | 🆕 | `POST/PUT /targets` |
| 115 | `ariba_targets_list` | 🆕 | `GET /targets?employee_id=&year=` |
| 116 | `ariba_task_update` | 🆕 gap | `POST /tasks/{id}/update` |
| 117 | `ariba_team_availability` | 🆕 gap | `GET /team/availability` |
| 118 | `ariba_upsert_location` | ✅ | `POST/PATCH /locations` |
| 119 | `ariba_workflow_action` | ✏️ | `POST /me/approvals/{id} + /requests/{id}/approve|reject` |
| 120 | `ariba_candidate_submit` | 🆕 public | `POST /public/apply?k=` |
| 121 | `ariba_candidate_invite_check` | 🆕 public | `GET /public/apply/invite/{token}` |
| 122 | `ariba_candidate_submit_invite` | 🆕 public | `POST /public/apply/invite/{token}` |

### 10. The 188 rows and the action for each row

Exceptions: row 66 and rows 113 and 142 per decisions 1 and 2. Totals: 🟢 81 · 🟠 32 (30 + 113 + 142) · 🔴 24 · 🔵 42 · 🟣 9 (11 − 2).

| No. | Domain | Formula | Status | Action | Our files |
|---|---|---|---|---|---|
| 1 | Payroll (PAYX) | V salary by days | Matching | 🟢 stays | — |
| 2 | Payroll (PAYX) | Y housing allowance by days | Matching | 🟢 stays | — |
| 3 | Payroll (PAYX) | Z transportation allowance by days | Matching | 🟢 stays | — |
| 4 | Payroll (PAYX) | AA project allowance by days | Matching | 🟢 stays | — |
| 5 | Payroll (PAYX) | AB other allowances by days | Matching | 🟢 stays | — |
| 6 | Payroll (PAYX) | T salary including allowances | Matching | 🟢 stays | — |
| 7 | Payroll (PAYX) | X overtime | Matching | 🟢 stays | — |
| 8 | Payroll (PAYX) | I contract end | Matching | 🟢 stays | — |
| 9 | Payroll (PAYX) | Last day inclusive (+1 day) | Matching | 🟢 stays | — |
| 10 | Payroll (PAYX) | AD/AE/AF service duration years/months/days | Matching | 🟢 stays | — |
| 11 | Payroll (PAYX) | K years of service | Matching | 🟢 stays | — |
| 12 | Payroll (PAYX) | N leave balance during the contract | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 13 | Payroll (PAYX) | O amount accrued (days taken) | Matching | 🟢 stays | — |
| 14 | Payroll (PAYX) | P balance due | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 15 | Payroll (PAYX) | AC leave allowance | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 16 | Payroll (PAYX) | AG cost of years | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 17 | Payroll (PAYX) | AH cost of months | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 18 | Payroll (PAYX) | AI cost of days | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 19 | Payroll (PAYX) | AJ total gratuity | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 20 | Payroll (PAYX) | Termination reasons and gratuity factor | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 21 | Payroll (PAYX) | Detecting the termination reason from text | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 22 | Payroll (PAYX) | AK end-of-service gratuity | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 23 | Payroll (PAYX) | AM total due | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 24 | Payroll (PAYX) | Social insurance days | Matching | 🟢 stays | — |
| 25 | Payroll (PAYX) | AQ wage subject to social insurance | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 26 | Payroll (PAYX) | AO employee social insurance | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 27 | Payroll (PAYX) | AR company social insurance | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 28 | Payroll (PAYX) | Age 55 | Matching | 🟢 stays | — |
| 29 | Payroll (PAYX) | AU total deductions | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 30 | Payroll (PAYX) | AV / AW net and net in SAR | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payx.ts |
| 31 | Payroll (PAYX) | Income tax and martyrs' fund (Egypt) | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 32 | Payroll rows | Who enters the payroll | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payroll.ts buildRows |
| 33 | Payroll rows | Default working/insurance days | Matching | 🟢 stays | — |
| 34 | Payroll rows | Default social insurance status | Matching | 🟢 stays | — |
| 35 | Payroll rows | Default values on ↺ | Matching | 🟢 stays | — |
| 36 | Payroll rows | Annual leave days in the row | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payroll.ts enrich |
| 37 | Payroll rows | Passing noEos to the engine | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/payroll.ts recalc |
| 38 | Payroll rows | Social insurance exemption with manual edit | Matching | 🟢 stays | — |
| 39 | Payroll rows | Working days from the last day | Matching | 🟢 stays | — |
| 40 | Payroll rows | Editing a field in the row | Matching | 🟢 stays | — |
| 41 | Payroll rows | Migrating legacy overtime to a manual amount | Theirs only | 🔵 added | lib/calc/payroll.ts |
| 42 | Payroll rows | Payroll totals | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payroll.ts sums |
| 43 | Payroll rows | Payroll export columns | Matching | 🟢 stays | — |
| 44 | Payroll rows | Amount accrued (usedThrough) | Nearly matching | 🟠 modified | backend/app/services/leave.py used_through |
| 45 | Social insurance | Rates table by date | Not matching | 🔴 modified | backend/app/routers/canonical.py GOSI_DEFAULT |
| 46 | Social insurance | Rates before 2026 | Not matching | 🔴 modified | backend/app/routers/canonical.py gosi_rates |
| 47 | Social insurance | Rate for age 55 and over | Matching | 🟢 stays | — |
| 48 | Social insurance | Wage cap | Matching | 🟢 stays | — |
| 49 | Social insurance | Employee's subject wage | Matching | 🟢 stays | — |
| 50 | Social insurance | Exemption (kindOf) | Matching | 🟢 stays | — |
| 51 | Social insurance | Exemption insSystem = exempt | Matching | 🟢 stays | — |
| 52 | Social insurance | Consultant = not applicable | Matching | 🟢 stays | — |
| 53 | Social insurance | Social insurance status text | Matching | 🟢 stays | — |
| 54 | Social insurance | Employee social insurance when saving their data (31/31) | Nearly matching | 🟠 modified | backend/app/routers/canonical.py _store_figures |
| 55 | Social insurance | Social insurance for an unsaved payslip | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/payroll.ts calcEmployeeGosi |
| 56 | Social insurance | Egypt social insurance | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 57 | Employee data | Gross salary | Matching | 🟢 stays | — |
| 58 | Employee data | Net salary | Nearly matching | 🟠 modified | backend/app/services/employee_map.py figures |
| 59 | Employee data | Net in SAR and exchange rate | Matching | 🟢 stays | — |
| 60 | Employee data | Fixed-term contract end | Matching | 🟢 stays | — |
| 61 | Employee data | Remaining days (iqama/passport/contract/medical insurance) | Matching | 🟢 stays | — |
| 62 | Employee data | Years of service in the record | Nearly matching | 🟠 modified | backend/app/routers/canonical.py salary_basis |
| 63 | Employee data | Fixing net stored in a foreign currency | Theirs only | 🔵 added | services/employee_map.py |
| 64 | Employee data | New employee number and username | Matching | 🟢 stays | — |
| 65 | Employee data | Allowance as a percentage of basic | Theirs only | 🔵 added | components/hr/employee-form.tsx + services/employee_map.py |
| 66 | Employee data | Automatic termination and activation at contract end | Ours only | 🟣 automatic termination removed + 🔵 reactivation on save and a "Reactivate" button (decision 2) | backend/app/services/contracts.py + canonical.py _reactivate_if_renewed |
| 67 | End of service | Art. 84 gratuity | Matching | 🟢 stays | — |
| 68 | End of service | Art. 74 / Art. 74(3) / Art. 74(4) | Matching | 🟢 stays | — |
| 69 | End of service | Art. 85 / Art. 75 resignation | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/eos.ts |
| 70 | End of service | Art. 87 full gratuity | Ours only | 🟣 removed | frontend/hr-web/src/lib/calc/eos.ts |
| 71 | End of service | Art. 77 open-ended contract | Matching | 🟢 stays | — |
| 72 | End of service | Art. 77 fixed-term contract | Ours only | 🟣 removed | frontend/hr-web/src/lib/calc/eos.ts |
| 73 | End of service | Art. 80 disciplinary dismissal | Matching | 🟢 stays | — |
| 74 | End of service | Gratuity base on the page | Not matching | 🔴 modified | frontend/hr-web/src/app/(hr)/(portal)/end-of-service/page.tsx |
| 75 | End of service | Years of service on the page | Matching | 🟢 stays | — |
| 76 | End of service | Duration text "Y years M months D days" | Matching | 🟢 stays | — |
| 77 | End of service | Employee record gratuity (calcEOS) | Matching | 🟢 stays | — |
| 78 | Settlement | Duration years/months/days and years | Matching | 🟢 stays | — |
| 79 | Settlement | e84 | Matching | 🟢 stays | — |
| 80 | Settlement | Art. 84 / Art. 74 / retirement / death | Matching | 🟢 stays | — |
| 81 | Settlement | Art. 85 / Art. 75 | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/settlement.ts |
| 82 | Settlement | Art. 87 | Ours only | 🟣 removed | frontend/hr-web/src/lib/calc/settlement.ts |
| 83 | Settlement | Art. 77 | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/settlement.ts |
| 84 | Settlement | Art. 80 / Art. 53 | Matching | 🟢 stays | — |
| 85 | Settlement | Accrued leave | Matching | 🟢 stays | — |
| 86 | Settlement | Remaining balance and its allowance | Matching | 🟢 stays | — |
| 87 | Settlement | Period salary | Matching | 🟢 stays | — |
| 88 | Settlement | Excess leave deduction | Matching | 🟢 stays | — |
| 89 | Settlement | Additions and deductions (amount or days) | Matching | 🟢 stays | — |
| 90 | Settlement | Net | Not matching | 🔴 modified | frontend/hr-web/src/lib/calc/settlement.ts |
| 91 | Settlement | Rounding inputs | Nearly matching | 🟠 modified | frontend/hr-web/src/lib/calc/settlement.ts |
| 92 | Settlement | Default salary when selecting the employee | Matching | 🟢 stays | — |
| 93 | Settlement | Settlement document and amount in words | Matching | 🟢 stays | — |
| 94 | Settlement | Egypt settlement | Theirs only | 🔵 added | lib/calc/settlement.ts |
| 95 | Leaves | Working day | Matching | 🟢 stays | — |
| 96 | Leaves | Expanding public holidays | Matching | 🟢 stays | — |
| 97 | Leaves | Working days in the year | Matching | 🟢 stays | — |
| 98 | Leaves | Accrual method | Not matching | 🔴 modified | backend/app/services/leave.py accrued |
| 99 | Leaves | Carry-forward cap | Nearly matching | 🟠 modified | backend/app/services/leave.py CARRY_CAP |
| 100 | Leaves | 2024 carry-forward | Ours only | 🟣 removed | backend/app/services/leave.py carry_forward |
| 101 | Leaves | Carry-forward chain from the previous year | Nearly matching | 🟠 modified | backend/app/services/leave.py carry_forward |
| 102 | Leaves | Year closing | Nearly matching | 🟠 modified | backend/app/services/leave.py ledger |
| 103 | Leaves | Imported year-end balance (yearEnd) | Not matching | 🔴 modified | backend/app/services/leave.py |
| 104 | Leaves | Imported current balance (current) | Not matching | 🔴 modified | backend/app/services/leave.py current |
| 105 | Leaves | Baseline used (baseline) | Nearly matching | 🟠 modified | backend/app/services/leave.py default_used |
| 106 | Leaves | Approved leaves after the snapshot date (asOf) | Matching | 🟢 stays | — |
| 107 | Leaves | Restoring annual leave interrupted by another leave | Theirs only | 🔵 added | services/leave.py + lib/leave.ts |
| 108 | Leaves | Manual adjustments | Matching | 🟢 stays | — |
| 109 | Leaves | End-of-service surplus per year | Not matching | 🔴 modified | backend/app/services/leave.py ledger |
| 110 | Leaves | Accumulated end-of-service surplus | Not matching | 🔴 modified | backend/app/services/leave.py accumulated_eos |
| 111 | Leaves | Totals since joining (accrued/used/remaining) | Matching | 🟢 stays | — |
| 112 | Leaves | Employee app balance | Not matching | 🔴 modified | backend/app/services/leave.py app_current |
| 113 | Leaves | Year-end balance in the app | Ours only | 🟠 modified (decision 1: "Year-end balance" like Home.jsx) | backend/app/services/leave.py app_year_end |
| 114 | Leaves | Terminated employee's balance | Ours only | 🟣 removed | backend/app/services/leave.py summary |
| 115 | Leaves | Annual leave request days | Matching | 🟢 stays | — |
| 116 | Leaves | Request days for other leaves | Matching | 🟢 stays | — |
| 117 | Leaves | Yearly balances editor | Nearly matching | 🟠 modified | backend/app/routers/canonical.py update_leave_balance |
| 118 | Leaves | Annual leave days overlapping another leave (preview) | Theirs only | 🔵 added | services/leave.py + lib/leave.ts |
| 119 | Leaves | Balance after the request in the app | Nearly matching | 🟠 modified | frontend/employee-app/app/(tabs)/leaves.tsx |
| 120 | Leaves | Egypt leaves | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 121 | Attendance and punch | Grouping the day's sessions | Matching | 🟢 stays | — |
| 122 | Attendance and punch | Classifying each day | Matching | 🟢 stays | — |
| 123 | Attendance and punch | Employee summary (expected, lateness, early leave, percentage, average check-in) | Matching | 🟢 stays | — |
| 124 | Attendance and punch | Report filters | Matching | 🟢 stays | — |
| 125 | Attendance and punch | Official working hours schedule and Ramadan | Theirs only | 🔵 added | services/schedule.py + lib/calc/schedule.ts |
| 126 | Attendance and punch | Determining Ramadan | Theirs only | 🔵 added | services/schedule.py + lib/calc/schedule.ts |
| 127 | Attendance and punch | Distance (haversine) | Matching | 🟢 stays | — |
| 128 | Attendance and punch | Inside the polygon | Matching | 🟢 stays | — |
| 129 | Attendance and punch | Location selection (smallest first) | Matching | 🟢 stays | — |
| 130 | Attendance and punch | Remote work | Matching | 🟢 stays | — |
| 131 | Attendance and punch | Automatic close 23:59 | Matching | 🟢 stays | — |
| 132 | Attendance and punch | Lateness (fixed hours) | Matching | 🟢 stays | — |
| 133 | Attendance and punch | Lateness (flexible hours) | Matching | 🟢 stays | — |
| 134 | Attendance and punch | Preventing early check-in (flexible) | Matching | 🟢 stays | — |
| 135 | Attendance and punch | Expected check-out | Nearly matching | 🟠 modified | backend/app/routers/canonical.py my_attendance |
| 136 | Attendance and punch | Early leave (flexible) | Nearly matching | 🟠 modified | backend/app/routers/canonical.py _punch_early |
| 137 | Attendance and punch | Clearing the previous session's check-out on a new check-in | Ours only | 🟣 removed | backend/app/routers/canonical.py punch |
| 138 | Attendance and punch | Grace = zero | Matching | 🟢 stays | — |
| 139 | Attendance and punch | Location check before punching in the app | Nearly matching | 🟠 modified | frontend/employee-app/lib/geo.ts evaluate |
| 140 | Attendance and punch | Completed hours and progress ring | Matching | 🟢 stays | — |
| 141 | Attendance and punch | Absentees card on the attendance page | Nearly matching | 🟠 modified | frontend/hr-web/src/app/(hr)/(portal)/attendance/page.tsx |
| 142 | Attendance and punch | Yearly remote work days counter | Ours only | 🟠 modified (decision 1: remote_days_per_year − used, default 10) | backend/app/routers/canonical.py my_attendance |
| 143 | Dashboard and reports | Saudization rate | Matching | 🟢 stays | — |
| 144 | Dashboard and reports | Identifying females | Matching | 🟢 stays | — |
| 145 | Dashboard and reports | Total salaries | Matching | 🟢 stays | — |
| 146 | Dashboard and reports | Salaries by work entity | Nearly matching | 🟠 modified | backend/app/routers/canonical.py dashboard |
| 147 | Dashboard and reports | Dashboard alerts | Not matching | 🔴 modified | backend/app/routers/canonical.py dashboard |
| 148 | Dashboard and reports | Probation end alert | Theirs only | 🔵 added | routers/canonical.py dashboard |
| 149 | Dashboard and reports | Side document alerts | Matching | 🟢 stays | — |
| 150 | Dashboard and reports | Remaining days in reports | Nearly matching | 🟠 modified | frontend/hr-web/src/app/(hr)/(portal)/reports/page.tsx |
| 151 | Dashboard and reports | Salary report net | Matching | 🟢 stays | — |
| 152 | Dashboard and reports | Age and years of service in the custom report | Theirs only | 🔵 added | reports/custom (new) |
| 153 | Dashboard and reports | Labor law notice on the request | Ours only | 🟣 removed | backend/app/routers/canonical.py _law_note |
| 154 | Forms | Salary certificate total | Matching | 🟢 stays | — |
| 155 | Forms | Probation evaluation average | Matching | 🟢 stays | — |
| 156 | Forms | Amount in words | Matching | 🟢 stays | — |
| 157 | Forms | Job offer from the salary calculator | Theirs only | 🔵 added | lib/calc/forms.ts + templates/page.tsx |
| 158 | Request workflow | Approval stages | Nearly matching | 🟠 modified | backend/app/routers/canonical.py _stages |
| 159 | Request workflow | Escalation after the deadline | Theirs only | 🔵 added | services/workflow2.py + routers/workflow.py |
| 160 | Request workflow | Salary advance limit | Theirs only | 🔵 added | services/workflow2.py + routers/workflow.py |
| 161 | Request workflow | Unpaid leave | Theirs only | 🔵 added | services/workflow2.py + routers/workflow.py |
| 162 | Request workflow | Manager and head deadline | Theirs only | 🔵 added | services/workflow2.py + routers/workflow.py |
| 163 | New features | Salary calculator: gross ← components | Theirs only | 🔵 added | lib/calc/salcalc.ts + finance/salary-calculator (new) |
| 164 | New features | Salary calculator: net ← components | Theirs only | 🔵 added | lib/calc/salcalc.ts + finance/salary-calculator (new) |
| 165 | New features | Salary calculator: basic ← gross and net | Theirs only | 🔵 added | lib/calc/salcalc.ts + finance/salary-calculator (new) |
| 166 | New features | Salary calculator: allowance required for a target net | Theirs only | 🔵 added | lib/calc/salcalc.ts + finance/salary-calculator (new) |
| 167 | New features | Company cost in the salary calculator | Theirs only | 🔵 added | lib/calc/salcalc.ts + finance/salary-calculator (new) |
| 168 | New features | VAT from the inclusive amount | Theirs only | 🔵 added | lib/calc/tax.ts + finance/tax-calculator (new) |
| 169 | New features | VAT from the exclusive amount | Theirs only | 🔵 added | lib/calc/tax.ts + finance/tax-calculator (new) |
| 170 | New features | Monthly social insurance file | Theirs only | 🔵 added | lib/calc/inscalc.ts + finance/insurance-calculator (new) |
| 171 | New features | Provisions report | Theirs only | 🔵 added | lib/calc/provisions.ts + finance/provisions (new) |
| 172 | New features | Salary transfer file (WPS) | Theirs only | 🔵 added | lib/calc/wps.ts + finance/wps (new) |
| 173 | New features | IBAN and ID validation | Theirs only | 🔵 added | lib/calc/wps.ts + finance/wps (new) |
| 174 | New features | Asset depreciation | Theirs only | 🔵 added | services/assets.py + lib/calc/assets.ts + finance/assets (new) |
| 175 | New features | Annual depreciation rate | Theirs only | 🔵 added | services/assets.py + lib/calc/assets.ts + finance/assets (new) |
| 176 | New features | Annual asset inventory | Theirs only | 🔵 added | services/assets.py + lib/calc/assets.ts + finance/assets (new) |
| 177 | New features | Target achievement percentage | Theirs only | 🔵 added | services/goals.py + lib/calc/goals.ts + goals/ eval/ (new) |
| 178 | New features | Evaluation score | Theirs only | 🔵 added | services/goals.py + lib/calc/goals.ts + goals/ eval/ (new) |
| 179 | New features | Evaluation rating | Theirs only | 🔵 added | services/goals.py + lib/calc/goals.ts + goals/ eval/ (new) |
| 180 | New features | Period key (annual/quarterly/monthly) | Theirs only | 🔵 added | services/goals.py + lib/calc/goals.ts + goals/ eval/ (new) |
| 181 | New features | Team availability | Theirs only | 🔵 added | routers/tasks.py + team/ (new) |
| 182 | New features | Income tax in Egypt | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 183 | New features | Martyrs' fund contribution in Egypt | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 184 | New features | Resignation factor in Egypt | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 185 | New features | Art. 77 compensation in Egypt | Theirs only | 🔵 added | lib/calc/country.ts + services/country.py (new) |
| 186 | New features | Date parsing in the AI assistant | Theirs only | 🔵 added | services/ai.py + components/hr/ai-assistant.tsx (new) |
| 187 | Login and sessions | Session duration | Nearly matching | 🟠 modified | backend/app/routers/canonical.py SESSION_HOURS |
| 188 | Login and sessions | Lockout after failed attempts | Ours only | 🟣 removed | backend/app/routers/canonical.py login |

---

# العربي

## خطة نقل نظام React إلى نظامنا (ARIBA HR)

> كُتب 2026-10-18 على الفرع `feature/hr-react-port` (من `main` عند `494998d`).
> المرجع: `~/Desktop/HR/مقارنة_المعادلات.xlsx` (188 صفاً)، كود قسم الموارد في `~/Desktop/مشروع الموارد البشرية/React` (للقراءة فقط)، `ARIBA_MASTER_CONTEXT.md`.
> القاعدة: نظامنا هو الأساس (FastAPI + Next.js 16 + Expo + سكيمة Railway المرتّبة). ننقل ميزاتهم ومعادلاتهم وشاشاتهم، لا طريقتهم التقنية: لا اتصال من المتصفح بالقاعدة، ولا حسابات نهائية في المتصفح، ولا PWA.

### 0. الرموز
- الصفوف: 🟢 يبقى · 🟠/🔴 يُعدَّل ليطابق معادلتهم · 🟣 يُحذف · 🔵 يُضاف.
- الدوال: ✅ موجود عندنا · ✏️ موجود ويُعدَّل · 🆕 جديد · ✖ لا يُنقل (يُستبدل بطريقتنا).
- المسارات كلها تحت `/api/v1`.

### 1. القرارات المعتمدة (من البرومبت، لا تُعاد)
1. الصفان 113 و142 لا يُحذفان: يُعدَّلان ليطابقا شاشة تطبيقهم (`Home.jsx`: «رصيد نهاية العام» و«عن بعد المتبقي» = `remote_days_per_year − remoteDaysUsed`، الافتراضي 10) وبطاقة الشركة «حد العمل عن بعد».
2. الصف 66: يُحذف الإنهاء التلقائي عند انتهاء العقد. يُنقل سلوكهم: حفظ موظف منتهٍ وعقده المحدد غير منتهٍ ← يرجع نشطاً، وزر «إعادة تفعيل» في القائمة.
3. ما يحفظونه في المتصفح ينتقل للخادم (`ariba_app_settings`): القوائم الرئيسية، قوالب التقارير، عدّاد رقم صادر تعريف الراتب، مكان إصدار الهوية. توقيع الموظف يبقى على جهازه فقط (`expo-secure-store` / المتصفح)، ويصل للخادم المستند بعد دمج التوقيع.
4. رصيد الإجازة في التطبيق وفريق المدير يحسبه الخادم بنفس المحرك والطريقة المختارة (`leave_accrual_method`). لا لقطات.
5. كلمات مرور البريد مشفّرة (AES-GCM، المفتاح `MAIL_SECRET_KEY` في متغيرات البيئة).
6. الإيميل: SMTP وResend وMicrosoft Graph، مرفقات PDF.
7. الحسابات في الخادم، أو في `lib/calc` بالموقع للعرض الفوري. المرجع النهائي نتيجة الخادم، بنفس معادلتهم.
8. خصم الإجازة بدون راتب والراتب المقدم من المسيّر يدوي مثلهم.
9. لا تُنقل عيوبهم: سجل التعديلات من المتصفح، الجرس كل 3 ثوانٍ، `sw.js`، الإعدادات المثبتة في الكود.

### 2. البنية الجديدة في خادمنا
| الملف | المحتوى |
|---|---|
| `backend/app/routers/canonical.py` | يبقى (المسارات الحالية) مع التعديلات |
| `backend/app/routers/port_workflow.py` | سير الطلبات الجديد: الأنواع الجديدة، الإرجاع، الرفض بسبب، التصعيد، إعدادات المهل، التفويض، صلاحيات المديرين، التقديم بالنيابة، طلبات الفريق |
| `backend/app/routers/port_candidates.py` | المرشحون والروابط + المسارات العامة `/public/apply*` |
| `backend/app/routers/port_goals.py` | المستهدفات والتقييم |
| `backend/app/routers/port_docs.py` | توقيع المستندات، مرفقات الإجازات |
| `backend/app/routers/port_mail.py` | حسابات البريد، إرسال مستند/تقرير، الرسائل |
| `backend/app/routers/port_tasks.py` | توفر الفريق، المهام والاجتماعات |
| `backend/app/routers/port_assets.py` | الأصول والعهد |
| `backend/app/routers/port_audit.py` | سجل التعديلات وطلبات حذف الشهر |
| `backend/app/routers/port_settings.py` | الإعدادات الجديدة (kv، صلاحيات، أدوار، رمضان، الهوية، الدولة…) + `/public/brand` + استعادة كلمة المرور + استخراج الألوان |
| `backend/app/routers/port_ai.py` | المساعد: تحليل الأمر في الخادم + تنفيذ بعد تأكيد |
| `backend/app/services/port_*.py` | المنطق: workflow2، mailer، crypto، scheduler، schedule (الدوام/رمضان)، country (مصر)، audit، tasks |
| `backend/app/services/scheduler.py` | مهام مجدولة داخل الخادم (asyncio): التصعيد كل ساعة، flush الإيميل كل 5 دقائق، التسجيل التلقائي للمرشحين كل دقيقة |

### 3. الجداول والإعدادات الجديدة (المهمة 5)
| الجدول | المفاتيح والروابط | مقابل عندهم |
|---|---|---|
| `ariba_candidates` | PK id uuid · `employee_id` FK → employee_directory (SET NULL) | نفسه |
| `ariba_candidate_files` | PK · `candidate_id` FK → ariba_candidates (CASCADE) | نفسه |
| `ariba_candidate_invites` | PK token · `candidate_id` FK (SET NULL) | نفسه |
| `ariba_targets` | PK · `employee_id` FK → employee_directory | نفسه |
| `ariba_evaluations` | PK · UNIQUE(employee_id, period_type, period_key) · FK | نفسه |
| `ariba_delegations` | PK employee_id FK · `manager_id` FK | نفسه |
| `ariba_manager_perms` | PK manager_id FK | نفسه |
| `ariba_doc_signing` | PK request_id · `document_id` FK → ariba_documents (CASCADE) · employee/manager FK | نفسه |
| `ariba_leave_files` | PK · `employee_id` FK · `leave_id` نص (رقم الطلب) | نفسه |
| `ariba_mail_accounts` | PK owner (`company` أو رقم الموظف) · `password_enc` bytea بدل النص | نفسه + تشفير |
| `ariba_tasks` | PK · `created_by` FK · kind task/meeting · title, notes, due_at, starts_at, ends_at, location, status | جديد (الملف `5_run_in_SQL_Editor_team_tasks_and_fixes.sql` لم يُسلَّم) |
| `ariba_task_assignees` | PK(task_id, employee_id) · FKs · status pending/accepted/declined/done · reason | جديد |
| `ariba_audit_purge_requests` | موجود عندنا | موجود |
| `ariba_assets`, `ariba_asset_custody_log` | موجودان عندنا | موجود |
| `ariba_webauthn_credentials` | PK · account_id FK → ariba_auth_accounts · credential_id, public_key, sign_count | جديد (الدخول بالبصمة في الموقع) |
| `ariba_push_tokens` | PK token · account_id FK | جديد (Push للتطبيق) |
| `workflow_notifications` | + `emailed_at`, `email_error`, `email_tries` | نفسه |

**الإعدادات (`ariba_app_settings`):** `workflow_config`، `doc_sign_cfg`، `leave_accrual_method`، `leave_carry`، `attendance_schedule`، `country_system`، `brand_colors`، `punch_watermark`، `letterhead`، `hr_signer`، `candidate_auto`، `apply_public_url`، `master_lists`، `report_templates`، `salary_cert_seq`، `id_issue_place`، `ins_settings`، `perms_matrix`. **(`ariba_security_flags`):** `apply_form_key`، `apply_invite_only`، `apply_invite_hours`. **(`company_settings`/attendance):** `ramadan_flex_enabled`، `ramadan_window_start/end`، `ramadan_shift_hours`، `ramadan_from/to`، `remote_days_per_year`.

### 4. قائمة الحذف 🟣 (المهمة 4)
| الصف | البند | الإجراء |
|---|---|---|
| 66 | الإنهاء التلقائي عند انتهاء العقد | يُحذف — **ويُضاف** إعادة التفعيل عند الحفظ + زر «إعادة تفعيل» (قرار 2) |
| 70، 82 | م.87 (تصحيح D) | يُحذف من الصفحة والمخالصة والمسيّر |
| 72 | م.77 للعقد المحدد (تصحيح C) | يُحذف — يُعامل كغير المحدد |
| 100 | قاعدة ترحيل 2024 | تُحذف |
| 113 | رصيد نهاية السنة في التطبيق | **لا يُحذف** — يُعدَّل (قرار 1) |
| 114 | تجميد رصيد المنتهي | يُحذف |
| 137 | تصفير خروج الجلسة السابقة (K) | يُحذف |
| 142 | عدّاد العمل عن بعد | **لا يُحذف** — يُعدَّل (قرار 1) |
| 153 | تنبيه نظام العمل على الطلبات (E/F) | يُحذف |
| 188 | قفل الدخول بعد المحاولات الفاشلة | يُحذف |
| — | تصحيحات A، B، G، J، K، I (تُحذف ضمن صفوفها 🔴 بمطابقة معادلتهم) | 20/69/81، 74، 25–27، 12، 136، تنبيه الأعياد I |

### 5. النواقص الست (تُبنى من سلوك شاشاتهم)
1. `ariba_team_availability` → `GET /team/availability`: دمج الإجازات المتتالية، «إجازة قريبة» خلال 14 يوماً، «يعود للعمل» = أول يوم عمل بعد الإجازة.
2. `ariba_my_tasks` / `ariba_send_task` / `ariba_task_update` → `/tasks`: مهمة أو اجتماع، تحذير لو مدعو في إجازة، تم/قبول/اعتذار بسبب/إلغاء.
3. `ariba_hr_set_ramadan_flex` → `PUT /settings/attendance/ramadan`، ويقرؤها `GET /settings/attendance` (+ `is_ramadan_today`).
4. `ariba_get_brand` → `GET /public/brand` (ألوان الشركة + شعار البصمة).
5. `ariba-password-recovery` → `POST /auth/password-recovery` (اسم المستخدم أو رقم الإقامة، كلمة مؤقتة على الإيميل المسجّل).
6. `ariba-brand-colors` → `POST /settings/brand/extract` (ألوان من رابط موقع الشركة).

### 6. إضافات التقرير والكود (🔵 خارج ملف المقارنة)
- مساعد أريبا AI (فهم العامية، فتح صفحات، إحصائيات، حضور، إجازة، رسالة، إعادة كلمة مرور، نموذج/مخالصة/قسيمة، تأكيد قبل التنفيذ) → `services/port_ai.py` (نقل `aiParse.js` إلى Python) + `components/hr/ai-assistant.tsx`.
- البصمة / Face ID: التطبيق `expo-local-authentication` + «تذكرني» و«نسيان هذا الجهاز»؛ الموقع WebAuthn (`ariba_webauthn_credentials`).
- حذف شهر أقدم من 30 يوماً من سجل التعديلات بطلب للمالية (موافقة/رفض).
- استيراد الموظفين من Excel/CSV مع مطابقة الأعمدة، معاينة، قالب، وتحديث الموجودين (V139).
- عربي/إنجليزي مع الاتجاه، الوضع الليلي، ألوان أريبا متغيرات (موجود جزئياً، يُستكمل).
- جرس إشعارات بعدّاد: الموقع يحدّث كل 20 ثانية؛ التطبيق Push + تحديث عند الفتح.
- البديل عند تعذّر الإرسال: تحميل PDF + فتح Outlook (سطح المكتب `mailto:` أو الويب)، إعداد لكل جهاز.
- الإعدادات في 9 أقسام مرقّمة مع بحث، 24 كارت.
- 10 مستندات عربي/إنجليزي (`<!--ARIBA_EN-->`)، العرض الوظيفي، رقم صادر `AR-YYYYMMDD-n` + هجري، إرسال جماعي، PDF A4 صفحة واحدة (تصغير حتى 1.35).
- تسجيل المرشحين تلقائياً (`candidate_auto`) كمهمة مجدولة.
- مسار المسيّر: تجهيز HR ← اعتماد المالية ← فتح بسبب ≥ 5 أحرف، حفظ تلقائي، مزامنة تعديلات الآخرين.
- الأصول والعهد: قسط ثابت، أعمار افتراضية، غير رأسمالي، جرد سنوي، تبويب العهدة في ملف الموظف.
- البدل كنسبة (`allowModes`)، التابعون مع مرفقاتهم، «استرجاع» لكل حقل.
- منشئ التقارير المخصص + قوالب محفوظة في الخادم + «تصدير الصفحة» (Excel/PDF/Word/إيميل).
- محرّر أرصدة السنوات (yearEnd/current/carryNext/eos يدوي) + سجل آخر 10 حفظات + «تراجع عن آخر حفظ».

### 7. المراحل (كل مرحلة commit وتُختبر وحدها)
| المرحلة | المحتوى | الاختبار |
|---|---|---|
| P1 | هذه الخطة | — |
| P2 | `tools/react-parity` (المرجع + المولد + المقارنة TS/Python) | تُظهر نفس فروق ملف المقارنة |
| P3a | PAYX + صفوف المسيّر (N، الاستقالة، noEos، G، الاستشاري الخارجي، الإضافي القديم، مصر) | react-parity صفر في PAYX |
| P3b | التأمينات (الجدول التلقائي) + بيانات الموظف + نهاية الخدمة + المخالصة | react-parity صفر |
| P3c | محرك الإجازات (الطرق الثلاث، الترحيل، المستورد، INTERRUPT، الفائض) | react-parity صفر + pytest |
| P3d | الحضور (الجدول ورمضان، الغائبين)، لوحة التحكم والتنبيهات، التقارير، 113/142 | pytest |
| P4 | حذف 🟣 + اختبار لكل بند | pytest + legacy-parity محدّث |
| P5 | ترحيل السكيما `docs/db-migrations/` + تجربته على نسخة من `ariba_after2` | سكربت التحقق |
| P6a–f | الخادم: سير الطلبات، المرشحون، المستهدفات، المستندات والتوقيع، البريد والمجدولة، المهام، الأصول، السجل، الإعدادات، المساعد | pytest لكل مسار |
| P7a–h | الموقع: المالية، الموظفون والمرشحون، الإجازات والفريق، المستهدفات، التقارير، الإعدادات، السجل، المساعد | تصفح محلي + لقطات |
| P8 | التطبيق: كل الشاشات | محاكي iOS + لقطات |
| P9 | نموذج التقديم العام `/apply` | pytest + تصفح |
| P10 | التحقق الكامل `docs/PORT_VERIFICATION.md` | كل الفحوصات |

### 8. الشاشات: عندهم ← عندنا
#### 8.1 برنامج الموارد (ARIBA_HR_React/src)
| ملفهم | الشاشة | عندنا (`frontend/hr-web/src/app/(hr)/(portal)/…`) |
|---|---|---|
| pages/Dashboard.jsx | لوحة التحكم | `dashboard/page.tsx` (يُعدَّل: التنبيهات V142، الرواتب حسب جهة العمل) |
| pages/employees/index.jsx, EmpList.jsx | الموظفون (قوائم: الحاليون، السعوديون، المقيمون، الاستشاريون، المستبعدون، بالمشروع) | `employees/page.tsx` (+ زر «إعادة تفعيل»، استيراد) |
| pages/employees/EmpForm.jsx | نموذج الموظف | `employees/new`, `employees/[id]` + `components/hr/employee-form.tsx` (+ البدل كنسبة، استرجاع لكل حقل، التابعون) |
| pages/employees/EmpDetails.jsx | تفاصيل الموظف | `components/hr/employee-details.tsx` |
| pages/employees/EmpCustody.jsx | تبويب العهدة | **جديدة** `components/hr/employee-custody.tsx` |
| pages/employees/EmpDocsBox.jsx | وثائق الموظف | `employee-details.tsx` (موجود) |
| pages/employees/Import.jsx | استيراد Excel/CSV | **جديدة** `employees/import/page.tsx` |
| pages/employees/PwReset.jsx | إعادة كلمة المرور | `components/common/password-dialog.tsx` (موجود) |
| pages/candidates/index.jsx | المرشحون | **جديدة** `candidates/page.tsx` |
| pages/candidates/Invites.jsx | روابط التقديم | **جديدة** `candidates/invites` (تبويب) |
| pages/goals/index.jsx + goals/TargetsEditor.jsx, PeriodPick.jsx | المستهدفات | **جديدة** `goals/page.tsx` |
| pages/goals/Eval.jsx + goals/EvalForm.jsx | التقييم | **جديدة** `evaluation/page.tsx` |
| pages/attendance/index.jsx | الحضور والانصراف | `attendance/page.tsx` (يُعدَّل: الغائبين، الجدول ورمضان) |
| pages/attendance/Locations.jsx | مواقع البصمة | `locations/page.tsx` (موجود) |
| pages/leaves/index.jsx | الإجازات والطلبات (تبويبات) | `leaves/page.tsx` |
| pages/leaves/Pending.jsx | الطلبات المعلقة (نيابة، نهائي، رفض بسبب، إرجاع، تصعيد) | `leaves/page.tsx` (يُعدَّل) |
| pages/leaves/AllRequests.jsx | كل الطلبات | `leaves/page.tsx` (موجود) |
| pages/leaves/Balances.jsx | محرّر الأرصدة | `leaves/page.tsx` تبويب الأرصدة (يُعدَّل: current تلقائي، سجل 10، تراجع) |
| pages/leaves/NewRequest.jsx | طلب جديد من HR | `leaves/page.tsx` (يُعدَّل: overlapWithAnnual، الأنواع الجديدة) |
| pages/leaves/Overtime.jsx | العمل الإضافي HR | `leaves/page.tsx` (موجود) |
| pages/leaves/Holidays.jsx | العطل الرسمية | `leaves/page.tsx` (موجود) |
| pages/team/index.jsx | توفر الفريق والمهام | **جديدة** `team/page.tsx` |
| pages/payroll/index.jsx, cols.jsx, output.js | مسير الرواتب | `payroll/page.tsx` (يُعدَّل: تجهيز/اعتماد/فتح، حفظ تلقائي، مزامنة) |
| pages/payroll/Archive.jsx | أرشيف المسيّر | `payroll/page.tsx` (موجود) |
| pages/finance/InsCalc.jsx | حاسبة التأمينات + ملف GOSI | **جديدة** `insurance-calculator/page.tsx` |
| pages/finance/SalCalc.jsx | حاسبة الراتب + العرض الوظيفي | **جديدة** `salary-calculator/page.tsx` |
| pages/finance/TaxCalc.jsx | حاسبة الضريبة | **جديدة** `tax-calculator/page.tsx` |
| pages/finance/Wps.jsx | ملف تحويل الرواتب | **جديدة** `wps/page.tsx` |
| pages/finance/Prov.jsx | تقرير المخصصات | **جديدة** `provisions/page.tsx` |
| pages/finance/Assets.jsx | الأصول والعهد | **جديدة** `assets/page.tsx` |
| pages/finance/Slip.jsx | كشف الراتب | `payslips/page.tsx` (يُعدَّل) |
| pages/finance/Eos.jsx | نهاية الخدمة | `end-of-service/page.tsx` (يُعدَّل) |
| pages/finance/EosCalc.jsx | المخالصة | `settlement/page.tsx` (يُعدَّل) |
| pages/docs/index.jsx | الوثائق | `documents/page.tsx` |
| pages/reports/index.jsx | التقارير | `reports/page.tsx` |
| pages/reports/CustomReport.jsx | منشئ التقارير | **جديدة** `reports/custom` (تبويب) |
| pages/settings/index.jsx + 22 بطاقة + shared.jsx | الإعدادات (9 أقسام، 24 كارت، بحث) | `settings/page.tsx` (يُعاد ترتيبه + البطاقات الجديدة) |
| pages/audit/index.jsx, SectionAudit.jsx, PurgeBox.jsx | سجل التعديلات + حذف شهر | **جديدة** `audit/page.tsx` |
| pages/forms/index.jsx, docs.js, formsEn.js, salaryCert.js, extraCards.jsx | النماذج (10 مستندات، إرسال جماعي) | `templates/page.tsx` + `lib/calc/forms*.ts` (يُعدَّل) |
| components/AiAssistant.jsx (+ lib/aiParse.js, aiBridge.js) | المساعد | **جديد** `components/hr/ai-assistant.tsx` |
| components/HrBell.jsx | جرس الإشعارات | **جديد** `components/hr/hr-bell.tsx` |
| components/PageExport.jsx, ExportDialog.jsx | تصدير الصفحة | **جديد** `components/hr/page-export.tsx` |
| components/Login.jsx, BioAsk.jsx | الدخول + نسيت كلمة المرور + البصمة | `(hr)/login/page.tsx` (يُعدَّل) |
| components/IdleGuard.jsx | الخمول 5 + 3 دقائق | **جديد** `components/hr/idle-guard.tsx` |
| components/CandAuto.jsx | تسجيل تلقائي للمرشحين | **في الخادم** (مهمة مجدولة) |
| components/DocPreview.jsx, Modal, PromptModal, Toast, ChartCanvas, Layout | مكونات عامة | موجودة عندنا (`modal.tsx`, `toast.tsx`, `charts.tsx`, `hr-shell.tsx`) |
| pages/Soon.jsx, registry.js | تسجيل الصفحات | `lib/routes.ts` |
| apply/ApplyApp.jsx | نموذج التقديم العام | **جديدة** `src/app/apply/page.tsx` (خارج البوابة) |

#### 8.2 تطبيق الموظف (ARIBA_Employee_React/src/employee)
| ملفهم | الشاشة | عندنا (`frontend/employee-app/…`) |
|---|---|---|
| Home.jsx + punch.jsx | الرئيسية: البصمة، دائرة التقدم، 3 بلاطات، إجراءات سريعة | `app/(tabs)/index.tsx` (يُعدَّل) |
| Att.jsx | الحضور (31 يوماً + فترة) | `app/(tabs)/attendance.tsx` |
| ForgotPunch.jsx | نسيان البصمة | `attendance.tsx` (موجود، يُطابَق) |
| Leaves.jsx + liveLeave.js | الإجازات (بدون راتب، راتب مقدم، استئذانات) | `app/(tabs)/leaves.tsx` (يُعدَّل) |
| Overtime.jsx | العمل الإضافي | `app/(tabs)/overtime.tsx` |
| Pay.jsx | الراتب والقسيمة PDF | `app/(tabs)/salary.tsx` (+ PDF) |
| Prof.jsx + ProfileRequests.jsx | ملفي، تعديل بيانات، تغيير الآيبان، رفع مستند | `app/(tabs)/profile.tsx` (يُعدَّل) + **جديدة** `app/profile-edit.tsx`, `app/iban-change.tsx`, `app/upload-document.tsx` |
| Docs.jsx + SigManager.jsx | المستندات والتوقيع | `app/(tabs)/documents.tsx` + `app/letter/[id].tsx` (+ التوقيع) |
| MgrSignDocs.jsx | توقيع المدير | **جديدة** `app/manager-sign.tsx` |
| Approvals.jsx | الموافقات | `app/(tabs)/approvals.tsx` (يُعدَّل) |
| Delegation.jsx | التفويض | **جديدة** `app/delegation.tsx` |
| Team.jsx + MgrTeam.jsx | فريقي + التقديم بالنيابة + المهام | `app/(tabs)/team.tsx` (يُعدَّل) + **جديدة** `app/submit-for.tsx`, `app/tasks.tsx` |
| goals/MyGoals.jsx | أهدافي وتقييمي | **جديدة** `app/(tabs)/goals.tsx` |
| Bell.jsx | الإشعارات | `src/lib/notifications.tsx` (موجود) + Push |
| WorkLocations.jsx | مواقع العمل | **جديدة** `app/work-locations.tsx` |
| EmpLogin.jsx + ChangePw.jsx | الدخول + Face ID + التغيير الإجباري | `app/login.tsx`, `app/change-password.tsx` (يُعدَّل) |
| theme.js, brand.js, nav.jsx, EmpApp.jsx, EmpStore.jsx | الثيم، الهوية، التبويبات، الحالة | `src/theme.tsx`, `src/lib/data.tsx`, `app/(tabs)/_layout.tsx` |


### 9. الدوال (119 + 3 عامة) ← مسارات خادمنا
| # | الدالة | الحالة | المقابل في خادمنا |
|---|---|---|---|
| 1 | `ariba_asset_custody` | 🆕 | `GET/POST /assets/{id}/custody` |
| 2 | `ariba_assets_delete` | 🆕 | `DELETE /assets/{id}` |
| 3 | `ariba_assets_list` | 🆕 | `GET /assets` |
| 4 | `ariba_assets_upsert` | 🆕 | `POST/PUT /assets` |
| 5 | `ariba_attendance` | ✅ | `POST /me/attendance/punch (+ رمضان المرن)` |
| 6 | `ariba_audit_add_many` | ✖ لا يُنقل | الخادم يكتب السجل بنفسه في كل مسار (قرار 9) |
| 7 | `ariba_audit_list` | 🆕 | `GET /audit` |
| 8 | `ariba_audit_purge_decide` | 🆕 | `POST /audit/purge/{id}/decide` |
| 9 | `ariba_audit_purge_info` | 🆕 | `GET /audit/purge` |
| 10 | `ariba_audit_purge_request` | 🆕 | `POST /audit/purge` |
| 11 | `ariba_change_my_password` | ✅ | `POST /auth/change-password` |
| 12 | `ariba_company_public` | ✅ | `GET /settings/company (+ /public/company للتطبيق)` |
| 13 | `ariba_delete_location` | ✅ | `DELETE /locations/{id}` |
| 14 | `ariba_delete_request` | ✅ | `DELETE /me/requests/{id}` |
| 15 | `ariba_doc_employee_sign` | 🆕 | `POST /me/letters/{id}/sign` |
| 16 | `ariba_doc_manager_pending` | 🆕 | `GET /me/sign/pending` |
| 17 | `ariba_doc_manager_sign` | 🆕 | `POST /me/sign/{request_id}` |
| 18 | `ariba_doc_my_states` | 🆕 | `GET /me/sign/states` |
| 19 | `ariba_doc_sign_cfg_get` | 🆕 | `GET /settings/doc-sign` |
| 20 | `ariba_doc_sign_cfg_set` | 🆕 | `PUT /settings/doc-sign` |
| 21 | `ariba_employee_ack_template` | ✅ | `POST /me/letters/{id}/respond` |
| 22 | `ariba_employee_context` | ✅ | `GET /me + /me/employee` |
| 23 | `ariba_employee_pending_templates` | ✅ | `GET /me/letters` |
| 24 | `ariba_eval_approve` | 🆕 | `POST /evaluations/{id}/approve` |
| 25 | `ariba_eval_get` | 🆕 | `GET /evaluations/{emp}/{type}/{key}` |
| 26 | `ariba_eval_list` | 🆕 | `GET /evaluations` |
| 27 | `ariba_eval_save` | 🆕 | `PUT /evaluations/{emp}/{type}/{key}` |
| 28 | `ariba_get_attendance_settings` | ✏️ | `GET /settings/attendance (+ حقول رمضان، remote_days_per_year)` |
| 29 | `ariba_get_brand` | 🆕 ناقصة | `GET /public/brand` |
| 30 | `ariba_get_document` | ✅ | `GET /documents/{id}/file` |
| 31 | `ariba_hr_apply_key_rotate` | 🆕 | `POST /candidates/apply-key/rotate` |
| 32 | `ariba_hr_apply_mode_set` | 🆕 | `PUT /candidates/apply-mode` |
| 33 | `ariba_hr_attendance_range` | ✅ | `GET /attendance/range` |
| 34 | `ariba_hr_candidate_accept` | 🆕 | `POST /candidates/{id}/accept` |
| 35 | `ariba_hr_candidate_by_ref` | 🆕 | `GET /candidates/by-ref/{ref}` |
| 36 | `ariba_hr_candidate_file` | 🆕 | `GET /candidates/files/{id}` |
| 37 | `ariba_hr_candidate_reject` | 🆕 | `POST /candidates/{id}/reject` |
| 38 | `ariba_hr_candidates` | 🆕 | `GET /candidates` |
| 39 | `ariba_hr_default_password_list` | 🆕 | `GET /auth/users/default-passwords` |
| 40 | `ariba_hr_delete_employee` | 🆕 | `DELETE /employees/{id} (أرشفة في ariba_deleted_items)` |
| 41 | `ariba_hr_delete_leave` | ✅ | `DELETE /requests/{id}` |
| 42 | `ariba_hr_final_approve` | ✅ | `POST /requests/{id}/final-approve` |
| 43 | `ariba_hr_get_setting` | 🆕 | `GET /settings/kv/{key}` |
| 44 | `ariba_hr_get_wf_config` | 🆕 | `GET /settings/workflow` |
| 45 | `ariba_hr_invite_create` | 🆕 | `POST /candidates/invites` |
| 46 | `ariba_hr_invite_revoke` | 🆕 | `POST /candidates/invites/{token}/revoke` |
| 47 | `ariba_hr_invites` | 🆕 | `GET /candidates/invites` |
| 48 | `ariba_hr_leave_snapshots` | ✖ يُستبدل | الخادم يحسب الرصيد مباشرة (قرار 4) — GET /leave/balances |
| 49 | `ariba_hr_leaves_since` | ✅ | `GET /leave/requests` |
| 50 | `ariba_hr_list_roles` | ✅ | `GET /settings/accounts` |
| 51 | `ariba_hr_locations` | ✅ | `GET /locations` |
| 52 | `ariba_hr_manager_perms` | 🆕 | `GET /settings/manager-perms` |
| 53 | `ariba_hr_override_workflow` | ✏️ | `POST /requests/{id}/override (نهائي حسب النوع)` |
| 54 | `ariba_hr_record_leave` | ✅ | `POST /requests` |
| 55 | `ariba_hr_reject` | ✏️ | `POST /requests/{id}/reject (سبب إلزامي)` |
| 56 | `ariba_hr_reset_password` | ✅ | `POST /auth/users/{id}/temporary-password` |
| 57 | `ariba_hr_return_to_manager` | 🆕 | `POST /requests/{id}/return` |
| 58 | `ariba_hr_run_escalation` | 🆕 | `POST /requests/escalate (+ مهمة مجدولة كل ساعة)` |
| 59 | `ariba_hr_send_message` | 🆕 | `POST /messages` |
| 60 | `ariba_hr_send_template` | ✅ | `POST /letters` |
| 61 | `ariba_hr_set_attendance_settings` | ✏️ | `PUT /settings/attendance (+ remote_days_per_year)` |
| 62 | `ariba_hr_set_flexible_hours` | ✅ | `PUT /settings/attendance` |
| 63 | `ariba_hr_set_leave_snapshots` | ✖ يُستبدل | لا لقطات من المتصفح (قرار 4) |
| 64 | `ariba_hr_set_manager_perms` | 🆕 | `PUT /settings/manager-perms/{manager_id}` |
| 65 | `ariba_hr_set_ramadan_flex` | 🆕 ناقصة | `PUT /settings/attendance/ramadan` |
| 66 | `ariba_hr_set_role` | ✅ | `PATCH /auth/users/{id}` |
| 67 | `ariba_hr_set_setting` | 🆕 | `PUT /settings/kv/{key}` |
| 68 | `ariba_hr_set_wf_config` | 🆕 | `PUT /settings/workflow` |
| 69 | `ariba_hr_submit_overtime` | ✅ | `POST /requests (overtime)` |
| 70 | `ariba_hr_template_status` | ✅ | `GET /letters` |
| 71 | `ariba_hr_terminate_employee` | ✅ | `POST /employees/{id}/terminate` |
| 72 | `ariba_leave_file_delete` | 🆕 | `DELETE /leave-files/{id}` |
| 73 | `ariba_leave_file_get` | 🆕 | `GET /leave-files/{id}` |
| 74 | `ariba_leave_file_list` | 🆕 | `GET /leave-files?leave_id=` |
| 75 | `ariba_leave_file_save` | 🆕 | `POST /leave-files` |
| 76 | `ariba_list_documents` | ✅ | `GET /employees/{id}/documents` |
| 77 | `ariba_mail_delete` | 🆕 | `DELETE /mail/{scope}` |
| 78 | `ariba_mail_get` | 🆕 | `GET /mail/{scope}` |
| 79 | `ariba_mail_set` | 🆕 | `PUT /mail/{scope} (كلمة المرور مشفّرة)` |
| 80 | `ariba_mark_notifications_read` | ✅ | `POST /me/notifications/read` |
| 81 | `ariba_mgr_my_perms` | 🆕 | `GET /me/manager-perms` |
| 82 | `ariba_mgr_team` | ✏️ | `GET /me/team (حسب صلاحيات المدير)` |
| 83 | `ariba_mgr_team_leave_snapshots` | ✖ يُستبدل | `GET /me/team (الرصيد من الخادم)` |
| 84 | `ariba_mgr_team_requests` | 🆕 | `GET /me/team/requests` |
| 85 | `ariba_my_attendance_range` | ✅ | `GET /me/attendance/range` |
| 86 | `ariba_my_delegation` | 🆕 | `GET /me/delegation` |
| 87 | `ariba_my_goals` | 🆕 | `GET /me/goals` |
| 88 | `ariba_my_leave_snapshot` | ✏️ | `GET /me/leave (الخادم بنفس المحرك والطريقة المختارة)` |
| 89 | `ariba_my_notifications` | ✅ | `GET /me/notifications` |
| 90 | `ariba_my_tasks` | 🆕 ناقصة | `GET /tasks?box=inbox|sent` |
| 91 | `ariba_password_status` | ✅ | `GET /me (must_change_password)` |
| 92 | `ariba_payroll_archive` | ✅ | `GET /payroll-archive` |
| 93 | `ariba_payroll_draft_get` | ✅ | `GET /sheets/{key}` |
| 94 | `ariba_payroll_prepare` | 🆕 | `POST /sheets/{key}/prepare` |
| 95 | `ariba_payroll_reopen` | ✏️ | `POST /sheets/{key}/unapprove (سبب ≥ 5 أحرف)` |
| 96 | `ariba_payroll_status_get` | ✅ | `GET /sheets/{key}` |
| 97 | `ariba_perms_matrix` | 🆕 | `GET /settings/permissions` |
| 98 | `ariba_perms_set` | 🆕 | `PUT /settings/permissions` |
| 99 | `ariba_save_document` | ✅ | `POST /employees/{id}/documents` |
| 100 | `ariba_send_task` | 🆕 ناقصة | `POST /tasks` |
| 101 | `ariba_set_delegation` | 🆕 | `PUT /me/delegation` |
| 102 | `ariba_staff_attendance` | ✅ | `GET /attendance` |
| 103 | `ariba_staff_employees` | ✅ | `GET /employees` |
| 104 | `ariba_staff_holidays` | ✅ | `GET /holidays` |
| 105 | `ariba_staff_queue` | ✅ | `GET /requests + GET /dashboard` |
| 106 | `ariba_staff_requests` | ✅ | `GET /requests` |
| 107 | `ariba_submit_request` | ✏️ | `POST /me/requests (unpaid, salary_advance, iban_change, profile_edit, document)` |
| 108 | `ariba_submit_request_for` | 🆕 | `POST /me/team/{employee_id}/requests` |
| 109 | `ariba_sync_attendance` | ✅ | `POST/PATCH /attendance` |
| 110 | `ariba_sync_employee` | ✅ | `POST/PATCH /employees` |
| 111 | `ariba_sync_holidays` | ✅ | `POST /holidays` |
| 112 | `ariba_sync_payroll` | ✅ | `PUT /sheets/{key}` |
| 113 | `ariba_target_delete` | 🆕 | `DELETE /targets/{id}` |
| 114 | `ariba_target_save` | 🆕 | `POST/PUT /targets` |
| 115 | `ariba_targets_list` | 🆕 | `GET /targets?employee_id=&year=` |
| 116 | `ariba_task_update` | 🆕 ناقصة | `POST /tasks/{id}/update` |
| 117 | `ariba_team_availability` | 🆕 ناقصة | `GET /team/availability` |
| 118 | `ariba_upsert_location` | ✅ | `POST/PATCH /locations` |
| 119 | `ariba_workflow_action` | ✏️ | `POST /me/approvals/{id} + /requests/{id}/approve|reject` |
| 120 | `ariba_candidate_submit` | 🆕 عامة | `POST /public/apply?k=` |
| 121 | `ariba_candidate_invite_check` | 🆕 عامة | `GET /public/apply/invite/{token}` |
| 122 | `ariba_candidate_submit_invite` | 🆕 عامة | `POST /public/apply/invite/{token}` |

### 10. الصفوف الـ 188 وإجراء كل صف

الاستثناءات: الصف 66 والصفان 113 و142 حسب القرارين 1 و2. المجموع: 🟢 81 · 🟠 32 (30 + 113 + 142) · 🔴 24 · 🔵 42 · 🟣 9 (11 − 2).

| م | المجال | المعادلة | الحالة | الإجراء | الملفات عندنا |
|---|---|---|---|---|---|
| 1 | المسيّر (PAYX) | V الراتب حسب الأيام | مطابق | 🟢 يبقى | — |
| 2 | المسيّر (PAYX) | Y بدل السكن بالأيام | مطابق | 🟢 يبقى | — |
| 3 | المسيّر (PAYX) | Z بدل المواصلات بالأيام | مطابق | 🟢 يبقى | — |
| 4 | المسيّر (PAYX) | AA بدل المشروع بالأيام | مطابق | 🟢 يبقى | — |
| 5 | المسيّر (PAYX) | AB البدلات الأخرى بالأيام | مطابق | 🟢 يبقى | — |
| 6 | المسيّر (PAYX) | T الراتب شامل البدلات | مطابق | 🟢 يبقى | — |
| 7 | المسيّر (PAYX) | X الإضافي | مطابق | 🟢 يبقى | — |
| 8 | المسيّر (PAYX) | I نهاية العقد | مطابق | 🟢 يبقى | — |
| 9 | المسيّر (PAYX) | آخر يوم شامل (+1 يوم) | مطابق | 🟢 يبقى | — |
| 10 | المسيّر (PAYX) | AD/AE/AF مدة الخدمة سنة/شهر/يوم | مطابق | 🟢 يبقى | — |
| 11 | المسيّر (PAYX) | K سنوات الخدمة | مطابق | 🟢 يبقى | — |
| 12 | المسيّر (PAYX) | N رصيد الإجازة خلال التعاقد | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 13 | المسيّر (PAYX) | O ما تم استحقاقه (أيام مأخوذة) | مطابق | 🟢 يبقى | — |
| 14 | المسيّر (PAYX) | P الرصيد المستحق | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 15 | المسيّر (PAYX) | AC بدل الإجازة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 16 | المسيّر (PAYX) | AG تكلفة السنوات | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 17 | المسيّر (PAYX) | AH تكلفة الشهور | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 18 | المسيّر (PAYX) | AI تكلفة الأيام | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 19 | المسيّر (PAYX) | AJ إجمالي المكافأة | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 20 | المسيّر (PAYX) | أسباب الإنهاء ومعامل المكافأة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 21 | المسيّر (PAYX) | التعرف على سبب الإنهاء من النص | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 22 | المسيّر (PAYX) | AK مكافأة نهاية الخدمة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 23 | المسيّر (PAYX) | AM إجمالي المستحق | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 24 | المسيّر (PAYX) | أيام التأمينات | مطابق | 🟢 يبقى | — |
| 25 | المسيّر (PAYX) | AQ الأجر الخاضع للتأمينات | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 26 | المسيّر (PAYX) | AO تأمينات الموظف | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 27 | المسيّر (PAYX) | AR تأمينات الشركة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 28 | المسيّر (PAYX) | عمر 55 سنة | مطابق | 🟢 يبقى | — |
| 29 | المسيّر (PAYX) | AU إجمالي المستقطع | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 30 | المسيّر (PAYX) | AV / AW الصافي والصافي بالريال | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payx.ts |
| 31 | المسيّر (PAYX) | ضريبة الدخل والشهداء (مصر) | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 32 | صفوف المسيّر | من يدخل المسيّر | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payroll.ts buildRows |
| 33 | صفوف المسيّر | أيام العمل/التأمينات الافتراضية | مطابق | 🟢 يبقى | — |
| 34 | صفوف المسيّر | حالة التأمينات الافتراضية | مطابق | 🟢 يبقى | — |
| 35 | صفوف المسيّر | القيم الافتراضية عند ↺ | مطابق | 🟢 يبقى | — |
| 36 | صفوف المسيّر | أيام الإجازة السنوية في الصف | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payroll.ts enrich |
| 37 | صفوف المسيّر | تمرير noEos للمحرك | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/payroll.ts recalc |
| 38 | صفوف المسيّر | الإعفاء من التأمينات مع التعديل اليدوي | مطابق | 🟢 يبقى | — |
| 39 | صفوف المسيّر | أيام العمل من آخر يوم | مطابق | 🟢 يبقى | — |
| 40 | صفوف المسيّر | تعديل حقل في الصف | مطابق | 🟢 يبقى | — |
| 41 | صفوف المسيّر | ترحيل الإضافي القديم لمبلغ يدوي | عندهم فقط | 🔵 يُضاف | lib/calc/payroll.ts |
| 42 | صفوف المسيّر | مجاميع المسيّر | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payroll.ts sums |
| 43 | صفوف المسيّر | أعمدة تصدير المسيّر | مطابق | 🟢 يبقى | — |
| 44 | صفوف المسيّر | ما تم استحقاقه (usedThrough) | شبه مطابق | 🟠 يُعدَّل | backend/app/services/leave.py used_through |
| 45 | التأمينات | جدول النسب حسب التاريخ | غير مطابق | 🔴 يُعدَّل | backend/app/routers/canonical.py GOSI_DEFAULT |
| 46 | التأمينات | النسب قبل 2026 | غير مطابق | 🔴 يُعدَّل | backend/app/routers/canonical.py gosi_rates |
| 47 | التأمينات | نسبة 55 سنة فأكثر | مطابق | 🟢 يبقى | — |
| 48 | التأمينات | الحد الأعلى للأجر | مطابق | 🟢 يبقى | — |
| 49 | التأمينات | الأجر الخاضع للموظف | مطابق | 🟢 يبقى | — |
| 50 | التأمينات | الإعفاء (kindOf) | مطابق | 🟢 يبقى | — |
| 51 | التأمينات | إعفاء insSystem = exempt | مطابق | 🟢 يبقى | — |
| 52 | التأمينات | الاستشاري = لا يطبق | مطابق | 🟢 يبقى | — |
| 53 | التأمينات | نص حالة التأمينات | مطابق | 🟢 يبقى | — |
| 54 | التأمينات | تأمينات الموظف عند حفظ بياناته (31/31) | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py _store_figures |
| 55 | التأمينات | تأمينات قسيمة غير محفوظة | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/payroll.ts calcEmployeeGosi |
| 56 | التأمينات | تأمينات مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 57 | بيانات الموظف | إجمالي الراتب | مطابق | 🟢 يبقى | — |
| 58 | بيانات الموظف | صافي الراتب | شبه مطابق | 🟠 يُعدَّل | backend/app/services/employee_map.py figures |
| 59 | بيانات الموظف | الصافي بالريال وسعر الصرف | مطابق | 🟢 يبقى | — |
| 60 | بيانات الموظف | نهاية العقد المحدد | مطابق | 🟢 يبقى | — |
| 61 | بيانات الموظف | الأيام المتبقية (إقامة/جواز/عقد/تأمين طبي) | مطابق | 🟢 يبقى | — |
| 62 | بيانات الموظف | سنوات الخدمة في السجل | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py salary_basis |
| 63 | بيانات الموظف | إصلاح الصافي المخزن بعملة أجنبية | عندهم فقط | 🔵 يُضاف | services/employee_map.py |
| 64 | بيانات الموظف | رقم الموظف الجديد واسم المستخدم | مطابق | 🟢 يبقى | — |
| 65 | بيانات الموظف | البدل كنسبة من الأساسي | عندهم فقط | 🔵 يُضاف | components/hr/employee-form.tsx + services/employee_map.py |
| 66 | بيانات الموظف | الإنهاء والتفعيل التلقائي عند انتهاء العقد | عندنا فقط | 🟣 يُحذف الإنهاء التلقائي + 🔵 إعادة التفعيل عند الحفظ وزر «إعادة تفعيل» (قرار 2) | backend/app/services/contracts.py + canonical.py _reactivate_if_renewed |
| 67 | نهاية الخدمة | مكافأة م.84 | مطابق | 🟢 يبقى | — |
| 68 | نهاية الخدمة | م.74 / م.74(3) / م.74(4) | مطابق | 🟢 يبقى | — |
| 69 | نهاية الخدمة | م.85 / م.75 الاستقالة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/eos.ts |
| 70 | نهاية الخدمة | م.87 مكافأة كاملة | عندنا فقط | 🟣 يُحذف | frontend/hr-web/src/lib/calc/eos.ts |
| 71 | نهاية الخدمة | م.77 عقد غير محدد | مطابق | 🟢 يبقى | — |
| 72 | نهاية الخدمة | م.77 عقد محدد المدة | عندنا فقط | 🟣 يُحذف | frontend/hr-web/src/lib/calc/eos.ts |
| 73 | نهاية الخدمة | م.80 فصل تأديبي | مطابق | 🟢 يبقى | — |
| 74 | نهاية الخدمة | وعاء المكافأة في الصفحة | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/app/(hr)/(portal)/end-of-service/page.tsx |
| 75 | نهاية الخدمة | سنوات الخدمة في الصفحة | مطابق | 🟢 يبقى | — |
| 76 | نهاية الخدمة | نص المدة «س سنة ش شهر ي يوم» | مطابق | 🟢 يبقى | — |
| 77 | نهاية الخدمة | مكافأة سجل الموظف (calcEOS) | مطابق | 🟢 يبقى | — |
| 78 | المخالصة | المدة سنة/شهر/يوم والسنوات | مطابق | 🟢 يبقى | — |
| 79 | المخالصة | e84 | مطابق | 🟢 يبقى | — |
| 80 | المخالصة | م.84 / م.74 / تقاعد / وفاة | مطابق | 🟢 يبقى | — |
| 81 | المخالصة | م.85 / م.75 | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/settlement.ts |
| 82 | المخالصة | م.87 | عندنا فقط | 🟣 يُحذف | frontend/hr-web/src/lib/calc/settlement.ts |
| 83 | المخالصة | م.77 | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/settlement.ts |
| 84 | المخالصة | م.80 / م.53 | مطابق | 🟢 يبقى | — |
| 85 | المخالصة | الإجازة المستحقة | مطابق | 🟢 يبقى | — |
| 86 | المخالصة | الرصيد المتبقي وبدله | مطابق | 🟢 يبقى | — |
| 87 | المخالصة | راتب الفترة | مطابق | 🟢 يبقى | — |
| 88 | المخالصة | خصم الإجازة الزائدة | مطابق | 🟢 يبقى | — |
| 89 | المخالصة | الإضافات والخصومات (مبلغ أو أيام) | مطابق | 🟢 يبقى | — |
| 90 | المخالصة | الصافي | غير مطابق | 🔴 يُعدَّل | frontend/hr-web/src/lib/calc/settlement.ts |
| 91 | المخالصة | تقريب المدخلات | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/lib/calc/settlement.ts |
| 92 | المخالصة | الراتب الافتراضي عند اختيار الموظف | مطابق | 🟢 يبقى | — |
| 93 | المخالصة | مستند المخالصة والتفقيط | مطابق | 🟢 يبقى | — |
| 94 | المخالصة | مخالصة مصر | عندهم فقط | 🔵 يُضاف | lib/calc/settlement.ts |
| 95 | الإجازات | يوم العمل | مطابق | 🟢 يبقى | — |
| 96 | الإجازات | توسيع العطل الرسمية | مطابق | 🟢 يبقى | — |
| 97 | الإجازات | أيام العمل في السنة | مطابق | 🟢 يبقى | — |
| 98 | الإجازات | طريقة الاستحقاق | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py accrued |
| 99 | الإجازات | حد الترحيل | شبه مطابق | 🟠 يُعدَّل | backend/app/services/leave.py CARRY_CAP |
| 100 | الإجازات | ترحيل 2024 | عندنا فقط | 🟣 يُحذف | backend/app/services/leave.py carry_forward |
| 101 | الإجازات | سلسلة الترحيل من السنة السابقة | شبه مطابق | 🟠 يُعدَّل | backend/app/services/leave.py carry_forward |
| 102 | الإجازات | إقفال السنة | شبه مطابق | 🟠 يُعدَّل | backend/app/services/leave.py ledger |
| 103 | الإجازات | رصيد نهاية السنة المستورد (yearEnd) | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py |
| 104 | الإجازات | الرصيد الحالي المستورد (current) | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py current |
| 105 | الإجازات | المستخدم الأساسي (baseline) | شبه مطابق | 🟠 يُعدَّل | backend/app/services/leave.py default_used |
| 106 | الإجازات | الإجازات المعتمدة بعد تاريخ اللقطة (asOf) | مطابق | 🟢 يبقى | — |
| 107 | الإجازات | استرجاع السنوية المقطوعة بإجازة أخرى | عندهم فقط | 🔵 يُضاف | services/leave.py + lib/leave.ts |
| 108 | الإجازات | التعديلات اليدوية | مطابق | 🟢 يبقى | — |
| 109 | الإجازات | فائض نهاية الخدمة لكل سنة | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py ledger |
| 110 | الإجازات | فائض نهاية الخدمة المتراكم | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py accumulated_eos |
| 111 | الإجازات | المجاميع منذ المباشرة (مستحق/مستخدم/متبقي) | مطابق | 🟢 يبقى | — |
| 112 | الإجازات | رصيد تطبيق الموظف | غير مطابق | 🔴 يُعدَّل | backend/app/services/leave.py app_current |
| 113 | الإجازات | رصيد نهاية السنة في التطبيق | عندنا فقط | 🟠 يُعدَّل (قرار 1: «رصيد نهاية العام» مثل Home.jsx) | backend/app/services/leave.py app_year_end |
| 114 | الإجازات | رصيد الموظف المنتهي | عندنا فقط | 🟣 يُحذف | backend/app/services/leave.py summary |
| 115 | الإجازات | أيام طلب السنوية | مطابق | 🟢 يبقى | — |
| 116 | الإجازات | أيام طلب الإجازات الأخرى | مطابق | 🟢 يبقى | — |
| 117 | الإجازات | محرّر أرصدة السنوات | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py update_leave_balance |
| 118 | الإجازات | أيام السنوية المتداخلة مع إجازة أخرى (معاينة) | عندهم فقط | 🔵 يُضاف | services/leave.py + lib/leave.ts |
| 119 | الإجازات | الرصيد بعد الطلب في التطبيق | شبه مطابق | 🟠 يُعدَّل | frontend/employee-app/app/(tabs)/leaves.tsx |
| 120 | الإجازات | إجازات مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 121 | الحضور والبصمة | تجميع جلسات اليوم | مطابق | 🟢 يبقى | — |
| 122 | الحضور والبصمة | تصنيف كل يوم | مطابق | 🟢 يبقى | — |
| 123 | الحضور والبصمة | ملخص الموظف (المتوقع، التأخير، الخروج المبكر، النسبة، متوسط الدخول) | مطابق | 🟢 يبقى | — |
| 124 | الحضور والبصمة | فلاتر التقرير | مطابق | 🟢 يبقى | — |
| 125 | الحضور والبصمة | جدول الدوام الرسمي ورمضان | عندهم فقط | 🔵 يُضاف | services/schedule.py + lib/calc/schedule.ts |
| 126 | الحضور والبصمة | تحديد رمضان | عندهم فقط | 🔵 يُضاف | services/schedule.py + lib/calc/schedule.ts |
| 127 | الحضور والبصمة | المسافة (haversine) | مطابق | 🟢 يبقى | — |
| 128 | الحضور والبصمة | داخل المضلع | مطابق | 🟢 يبقى | — |
| 129 | الحضور والبصمة | اختيار الموقع (الأصغر أولاً) | مطابق | 🟢 يبقى | — |
| 130 | الحضور والبصمة | العمل عن بعد | مطابق | 🟢 يبقى | — |
| 131 | الحضور والبصمة | الإغلاق التلقائي 23:59 | مطابق | 🟢 يبقى | — |
| 132 | الحضور والبصمة | التأخير (دوام ثابت) | مطابق | 🟢 يبقى | — |
| 133 | الحضور والبصمة | التأخير (دوام مرن) | مطابق | 🟢 يبقى | — |
| 134 | الحضور والبصمة | منع الدخول المبكر (مرن) | مطابق | 🟢 يبقى | — |
| 135 | الحضور والبصمة | الانصراف المتوقع | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py my_attendance |
| 136 | الحضور والبصمة | الخروج المبكر (مرن) | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py _punch_early |
| 137 | الحضور والبصمة | تصفير خروج الجلسة السابقة عند دخول جديد | عندنا فقط | 🟣 يُحذف | backend/app/routers/canonical.py punch |
| 138 | الحضور والبصمة | السماح = صفر | مطابق | 🟢 يبقى | — |
| 139 | الحضور والبصمة | فحص الموقع قبل البصمة في التطبيق | شبه مطابق | 🟠 يُعدَّل | frontend/employee-app/lib/geo.ts evaluate |
| 140 | الحضور والبصمة | الساعات المنجزة ودائرة التقدم | مطابق | 🟢 يبقى | — |
| 141 | الحضور والبصمة | بطاقة الغائبين في صفحة الحضور | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/app/(hr)/(portal)/attendance/page.tsx |
| 142 | الحضور والبصمة | عدّاد أيام العمل عن بعد في السنة | عندنا فقط | 🟠 يُعدَّل (قرار 1: remote_days_per_year − المستخدم، الافتراضي 10) | backend/app/routers/canonical.py my_attendance |
| 143 | لوحة التحكم والتقارير | نسبة السعودة | مطابق | 🟢 يبقى | — |
| 144 | لوحة التحكم والتقارير | تحديد الإناث | مطابق | 🟢 يبقى | — |
| 145 | لوحة التحكم والتقارير | إجمالي الرواتب | مطابق | 🟢 يبقى | — |
| 146 | لوحة التحكم والتقارير | الرواتب حسب جهة العمل | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py dashboard |
| 147 | لوحة التحكم والتقارير | تنبيهات لوحة التحكم | غير مطابق | 🔴 يُعدَّل | backend/app/routers/canonical.py dashboard |
| 148 | لوحة التحكم والتقارير | تنبيه نهاية فترة التجربة | عندهم فقط | 🔵 يُضاف | routers/canonical.py dashboard |
| 149 | لوحة التحكم والتقارير | تنبيهات الوثائق الجانبية | مطابق | 🟢 يبقى | — |
| 150 | لوحة التحكم والتقارير | الأيام المتبقية في التقارير | شبه مطابق | 🟠 يُعدَّل | frontend/hr-web/src/app/(hr)/(portal)/reports/page.tsx |
| 151 | لوحة التحكم والتقارير | صافي تقرير الرواتب | مطابق | 🟢 يبقى | — |
| 152 | لوحة التحكم والتقارير | العمر وسنوات الخدمة في التقرير المخصص | عندهم فقط | 🔵 يُضاف | reports/custom (جديدة) |
| 153 | لوحة التحكم والتقارير | تنبيه نظام العمل على الطلب | عندنا فقط | 🟣 يُحذف | backend/app/routers/canonical.py _law_note |
| 154 | النماذج | إجمالي شهادة الراتب | مطابق | 🟢 يبقى | — |
| 155 | النماذج | متوسط تقييم فترة التجربة | مطابق | 🟢 يبقى | — |
| 156 | النماذج | التفقيط | مطابق | 🟢 يبقى | — |
| 157 | النماذج | عرض وظيفي من حاسبة الراتب | عندهم فقط | 🔵 يُضاف | lib/calc/forms.ts + templates/page.tsx |
| 158 | سير الطلبات | مراحل الموافقة | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py _stages |
| 159 | سير الطلبات | التصعيد بعد المهلة | عندهم فقط | 🔵 يُضاف | services/workflow2.py + routers/workflow.py |
| 160 | سير الطلبات | حد الراتب المقدم | عندهم فقط | 🔵 يُضاف | services/workflow2.py + routers/workflow.py |
| 161 | سير الطلبات | الإجازة بدون راتب | عندهم فقط | 🔵 يُضاف | services/workflow2.py + routers/workflow.py |
| 162 | سير الطلبات | مهلة المدير والرئيس | عندهم فقط | 🔵 يُضاف | services/workflow2.py + routers/workflow.py |
| 163 | ميزات جديدة | حاسبة الراتب: إجمالي ← مكونات | عندهم فقط | 🔵 يُضاف | lib/calc/salcalc.ts + finance/salary-calculator (جديدة) |
| 164 | ميزات جديدة | حاسبة الراتب: صافي ← مكونات | عندهم فقط | 🔵 يُضاف | lib/calc/salcalc.ts + finance/salary-calculator (جديدة) |
| 165 | ميزات جديدة | حاسبة الراتب: أساسي ← إجمالي وصافي | عندهم فقط | 🔵 يُضاف | lib/calc/salcalc.ts + finance/salary-calculator (جديدة) |
| 166 | ميزات جديدة | حاسبة الراتب: بدل مطلوب لصافي محدد | عندهم فقط | 🔵 يُضاف | lib/calc/salcalc.ts + finance/salary-calculator (جديدة) |
| 167 | ميزات جديدة | تكلفة الشركة في حاسبة الراتب | عندهم فقط | 🔵 يُضاف | lib/calc/salcalc.ts + finance/salary-calculator (جديدة) |
| 168 | ميزات جديدة | ضريبة القيمة المضافة من الشامل | عندهم فقط | 🔵 يُضاف | lib/calc/tax.ts + finance/tax-calculator (جديدة) |
| 169 | ميزات جديدة | ضريبة القيمة المضافة من غير الشامل | عندهم فقط | 🔵 يُضاف | lib/calc/tax.ts + finance/tax-calculator (جديدة) |
| 170 | ميزات جديدة | ملف التأمينات الشهري | عندهم فقط | 🔵 يُضاف | lib/calc/inscalc.ts + finance/insurance-calculator (جديدة) |
| 171 | ميزات جديدة | تقرير المخصصات | عندهم فقط | 🔵 يُضاف | lib/calc/provisions.ts + finance/provisions (جديدة) |
| 172 | ميزات جديدة | ملف تحويل الرواتب (WPS) | عندهم فقط | 🔵 يُضاف | lib/calc/wps.ts + finance/wps (جديدة) |
| 173 | ميزات جديدة | فحص الآيبان والهوية | عندهم فقط | 🔵 يُضاف | lib/calc/wps.ts + finance/wps (جديدة) |
| 174 | ميزات جديدة | إهلاك الأصول | عندهم فقط | 🔵 يُضاف | services/assets.py + lib/calc/assets.ts + finance/assets (جديدة) |
| 175 | ميزات جديدة | نسبة الإهلاك السنوية | عندهم فقط | 🔵 يُضاف | services/assets.py + lib/calc/assets.ts + finance/assets (جديدة) |
| 176 | ميزات جديدة | جرد الأصول السنوي | عندهم فقط | 🔵 يُضاف | services/assets.py + lib/calc/assets.ts + finance/assets (جديدة) |
| 177 | ميزات جديدة | نسبة إنجاز المستهدف | عندهم فقط | 🔵 يُضاف | services/goals.py + lib/calc/goals.ts + goals/ eval/ (جديدة) |
| 178 | ميزات جديدة | درجة التقييم | عندهم فقط | 🔵 يُضاف | services/goals.py + lib/calc/goals.ts + goals/ eval/ (جديدة) |
| 179 | ميزات جديدة | تصنيف التقييم | عندهم فقط | 🔵 يُضاف | services/goals.py + lib/calc/goals.ts + goals/ eval/ (جديدة) |
| 180 | ميزات جديدة | مفتاح الفترة (سنوي/ربع/شهري) | عندهم فقط | 🔵 يُضاف | services/goals.py + lib/calc/goals.ts + goals/ eval/ (جديدة) |
| 181 | ميزات جديدة | توفر الفريق | عندهم فقط | 🔵 يُضاف | routers/tasks.py + team/ (جديدة) |
| 182 | ميزات جديدة | ضريبة الدخل في مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 183 | ميزات جديدة | مساهمة الشهداء في مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 184 | ميزات جديدة | معامل الاستقالة في مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 185 | ميزات جديدة | تعويض م.77 في مصر | عندهم فقط | 🔵 يُضاف | lib/calc/country.ts + services/country.py (جديد) |
| 186 | ميزات جديدة | قراءة التواريخ في المساعد الذكي | عندهم فقط | 🔵 يُضاف | services/ai.py + components/hr/ai-assistant.tsx (جديد) |
| 187 | الدخول والجلسات | مدة الجلسة | شبه مطابق | 🟠 يُعدَّل | backend/app/routers/canonical.py SESSION_HOURS |
| 188 | الدخول والجلسات | قفل بعد محاولات فاشلة | عندنا فقط | 🟣 يُحذف | backend/app/routers/canonical.py login |
