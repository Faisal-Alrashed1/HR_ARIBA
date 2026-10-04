# Design

Brand from the V114 prototypes: deep green **#014D3D**, bright green **#29B35E**, beige **#E4E4BC**, ink **#231F20**.

## Tokens (`src/app/globals.css`)
Semantic CSS variables, mapped into Tailwind as `bg-surface`, `text-muted`, `border-border`, `bg-accent`, etc.
Components never use raw hex colours.

| Token | Light (نهاري) | Night (ليلي) |
|---|---|---|
| `--bg` | #F4F0E4 | #071813 |
| `--surface` | #FFFFFF | #0E2A22 |
| `--text` | #231F20 | #EEF8F3 |
| `--accent` | #014D3D | #29B35E |

Theme: `data-theme="dark"` on `<html>`, stored in the `ariba_theme` cookie and read on the server (no flash).
Language: `ariba_lang` cookie → `lang` + `dir` on `<html>`.

## Type
IBM Plex Sans Arabic (Google Fonts via `next/font`) stands in for the brand font **ARIBA Two**. Drop the TTF
files into `src/app/fonts/` and switch `layout.tsx` to `next/font/local` when available.
Numbers, IDs, IBANs and dates use `.ltr-nums` so they read correctly inside Arabic text.
Dates are shown as DD/MM/YYYY (built by hand: Intl's Arabic output adds RTL marks that scramble the order).

## Layout
- HR portal: sidebar (collapses to a drawer below `lg`) + top bar with language/theme toggles and sign-out.
- Employee app: mobile-first column (max 42rem), sticky header, 6-item bottom navigation.
- Every data view has loading, error (with retry) and empty states (`components/ui/states.tsx`).

## Components (`src/components/ui`)
`Button` · `Input`/`Select`/`Textarea`/`Checkbox`/`ReadField` (labelled, with error/hint) · `Card`/`PageHeader`/`StatCard` ·
`Badge` (+ `expiryTone`: ≤30 days red, ≤90 amber) · `Tabs` · `Table` + `Pagination` · `Dialog` (native `<dialog>`) ·
`LoadingState`/`ErrorState`/`EmptyState`/`NotBuilt`/`Notice` · `Icons` (inline SVG).

## Print
A4, 16 mm margins; `.no-print` hides navigation and actions. Official letters (templates phase) will use the
company letterhead images on `.print-surface` pages.
