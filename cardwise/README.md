# Cardwise

Local-first tracker for credit & debit cards. Log or import purchases, auto-sort them into categories, set monthly budgets.

## Run

```bash
cd cardwise
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run lint
```

First launch → "Explore with demo data" to see 6 months of sample activity.

## Features

- **Cards** — credit/debit, network, 6 card styles, credit limit + utilization meter, statement-close countdown. Stores **last 4 digits only**.
- **Transactions** — add/edit/delete, purchases vs refunds/payments, search + filter by card / category / month, grouped by day, CSV export.
- **Auto-categorization** — built-in merchant keywords (`src/domain/categories.ts`) + user rules (Settings). Rules can re-categorize history. Inline category picker per row; manual picks stick.
- **CSV import** — bank statement CSV, auto-detects date/description/amount (or debit/credit) columns, sign flip, duplicate skip, preview before import. Parsed in-browser.
- **Dashboard** — month spend vs same point last month, 6-month bar chart, category share bar + ranked list (click → filtered activity), top merchants, recent activity.
- **Budgets** — per-category monthly limits with pace-aware status (on track / ahead of pace / over).
- **Settings** — currency, light/dark/system theme, JSON backup/restore, erase all.
- Responsive: sidebar on desktop, floating tab bar on mobile.

## Structure

```
src/
  domain/      types.ts, categories.ts (category defs + categorize())
  store/       store.tsx (reducer + localStorage), seed.ts (demo data)
  lib/         format.ts, stats.ts, csv.ts
  components/  CardVisual, MonthlyBars, CategoryBreakdown, TransactionList, Modal
  forms/       CardForm, TransactionForm, ImportDialog
  views/       Dashboard, Cards, Transactions, Budgets, Settings
```

## Extending

- New category → add id to `CategoryId` in `domain/types.ts`, entry in `CATEGORIES`, keywords in `BUILTIN`. Only 8 coloured slots exist (`--series-1..8`); extras should use `--series-other` or replace a slot.
- New state → add field to `AppState`, action to `Action` union + reducer case in `store/store.tsx`. Persisted automatically.
- Sync/backend → swap `load()` / the persist effect in `store/store.tsx` for an API.
