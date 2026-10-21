# Their HR program inside our site

`src/port/` is a copy of `reference/hr-react/ARIBA_HR_React/src` (their screens, components, libraries and styles),
so every HR screen looks and behaves like theirs. Each portal route (`src/app/(hr)/(portal)/*/page.tsx`) shows one of
their screens (their `pages/registry.js`), inside their layout, store and permission guard (`next/PortApp.jsx`).

Only the files below differ from theirs (`diff -rq` against the reference lists exactly these). Everything else is
byte-for-byte their code; ESLint skips it (they lint it with oxlint) except the files written for the port.

## Written for the port
| File | Why |
|---|---|
| `router.jsx` | The react-router pieces they use (`useNavigate`, `useLocation`, `useParams`, `Routes`, `Outlet`) on Next's router; their page ids ↔ our paths (`/emps` ↔ `/employees` …). |
| `next/PortApp.jsx`, `next/LoginApp.jsx`, `next/Shell.jsx`, `next/page.jsx` | Their `App.jsx`/`main.jsx` for Next: restore the session, their store + layout around each page, their Login as `/login`, their apply form as `/apply`, browser-only rendering. |

## Transport (Supabase → our server)
| File | Change |
|---|---|
| `lib/api.js` | `rpc(name, args)` maps each of their RPC names to our REST route (docs/17_PORT_PLAN.md §9) and returns their shape; `functionCall` maps their 4 edge functions; error codes their screens compare (`PAYROLL_NOT_PREPARED` …) stay the message. |
| `lib/auth.js` | Same exports; signs in with `/auth/login` / `/auth/refresh` / `/auth/logout`, tokens in our first-party cookies, role + permission matrix from `GET /me/perms`. |
| `lib/config.js` | No Supabase URL/key. |
| `lib/vault.js` | Fingerprint / Face ID is a WebAuthn passkey on our server (`/auth/webauthn/*`); the browser keeps only the username. |
| `apply/ApplyApp.jsx` | Calls `/public/apply…` instead of their RPCs. |
| `pages/candidates/index.jsx` | The public link points to our `/apply`. |
| `components/AiAssistant.jsx`, `HrBell.jsx`, `Layout.jsx`, `pages/employees/*.jsx`, `pages/finance/SalCalc.jsx`, `pages/candidates/index.jsx` | `import … from 'react-router-dom'` → `router.jsx` (one line). |

## Moved to the server (approved decisions, docs/17_PORT_PLAN.md §1)
| File | Change |
|---|---|
| `lib/audit.js` | No browser queue: the server writes every audit entry (employee field diffs, payroll edits, settings …) — decision 9. |
| `lib/leaveSnapshots.js` | Nothing sent from the browser; the server computes balances with the same engine — decision 4. |
| `lib/masterLists.js`, `lib/data.js` (one line), `pages/reports/CustomReport.jsx`, `pages/forms/salaryCert.js` | Department/employer lists, report templates, salary-certificate counter and issue place are kept in `ariba_app_settings`, not localStorage — decision 3. |
| `lib/candidates.js`, `components/CandAuto.jsx` | The server builds the employee from a candidate (same rules); automatic registration is a server job every minute, not a timer in an open HR browser. |
| `components/HrBell.jsx` | Polls every 20 s (plan §6), not every 3 s. |
| `lib/arLetterhead.js` | Their optional bundled letterhead images are not in their delivery (Vite `import.meta.glob`); the letterhead from Settings is used. |
| `engines/{runtime,country,empkind,holidays,insurance,payx}.js` | Re-export `src/lib/calc/*` — the same code (tools/react-parity) — so their screens and our pages share one runtime. `leave.js`, `payrollRows.js`, `attendance.js` are theirs unchanged. |

## Their build setup
| File | Change |
|---|---|
| `lib/ico-runtime.js` | Their `vite.config.js` makes this file the JSX runtime (every emoji → a Tabler icon). Here `next.config.ts` adds the same for files under `src/port` only (`next/ico/ico-loader.cjs` + `next/ico/jsx-*runtime.js`). Changed: React is imported as `react/jsx-runtime`, `jsxDEV` is added for dev mode, and inline styles pass through `next/palette.js` (below). |

## Our look on their screens (owner's request)
| File | Change |
|---|---|
| `pages/Dashboard.jsx`, `styles/ariba-ours.css` | Our dashboard (commits 673ddb1, 9a345ee, 8ee52fc, 1d2bbed): dark green border on every KPI tile, a line icon on each tile, payroll figure in the text colour (not purple), the male/female silhouettes (`components/hr/gender-icons.tsx`) in one colour, gradient department bars, chart colours as hex (a canvas cannot read `var(--…)`, they drew black). |
| `components/Layout.jsx` | The ARIBA logo (`/brand/ariba-logo.png`) in the sidebar when none is uploaded in Settings. |
| `next/palette.js`, `styles/ariba-ours.css`, `pages/settings/BrandCard.jsx` (`data-keep-color` on the swatches) | The company palette (owner, 2026-10-20): primary dark `#014D3D`, primary light `#28B35D`, secondary dark `#231F20`, secondary light `#E4E4BC`; red for errors only. Off-brand inline colours (blue / purple / teal / orange / brown) map to the nearest of the four; the badge / alert / toast classes too. The colour pickers keep their real colours. |
| `next/latn.js` (loaded by `next/Shell.jsx`, `next/page.jsx`) | Every number and date in English digits whatever locale a screen passes (`ar-SA`, `ar-EG` …). |
| `styles/ariba-ours.css` | The sidebar sits below the windows that open over the page (it was at the top z-index, hiding part of modals); radios / checkboxes keep their size (their `input{width:100%}` squeezed the text beside them). |
| `pages/leaves/Pending.jsx`, `pages/leaves/AllRequests.jsx`, `pages/forms/index.jsx` | A form the employee accepted shows as «📄 title» in HR's pending requests (with the signed copy) and in all requests; the forms archive says whether it waits for the manager's signature or HR's approval. |
| `styles/ariba-ours.css` (Apple-design review, 2026-10-21) | Added at the end, so their CSS stays theirs: no tap highlight / `touch-action: manipulation`, a visible keyboard focus ring (their CSS removes outlines), `prefers-reduced-motion` and `prefers-reduced-transparency`. Not done: their `:hover` rules are not wrapped in `@media (hover:hover)` and their 9-11px font sizes are unchanged, because that means editing their own files. |
