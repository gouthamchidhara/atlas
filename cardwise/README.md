# Cardwise

Local-first tracker for credit & debit cards. Log or import purchases, auto-sort them into categories, set monthly budgets.

## Run

```bash
cd cardwise
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run lint
npm test         # logic tests (planner, rewards, alerts, dates)
```

First launch → "Explore with demo data" to see 6 months of sample activity.

## Why another card app?

Most trackers stop at "here's what you spent". Cardwise is card-centric:

- **Which card should I swipe?** Per-card reward rates → best card per category, and "you left $X on the table" when the wrong card was used.
- **Is the annual fee worth it?** Rewards earned (annualized) vs. fee, per card.
- **Alerts you design, per card** — with a 30-day **backtest** so you see how noisy a rule is before saving it.
- **A dashboard you build** — widgets from any metric × period × card/category/merchant scope.
- Local-first: no account, no bank login, data never leaves the browser.

## Features

- **Custom widgets** — Number (with change vs. previous period + sparkline), Trend bars, Breakdown (by category / merchant / card), Goal (target with pace marker), Card (cycle spend, utilization, close date), Activity. Scope by cards, categories, merchant text; periods incl. *current statement cycle*. Templates, live preview, 3 sizes, drag to reorder.
- **Alerts & notifications** — rule builder with 10 triggers: large purchase, merchant watch, first-time merchant, category spend (amount or % of budget), card monthly spend, credit utilization, statement closing (+ "pay $X to report under 10%"), card expiring, subscription price change, better card available. Any card or a specific one. In-app inbox (read/unread, severity), unread badge, toast, optional browser push. Re-evaluated on every data change + hourly; each event fires once.
- **Payments** — per credit card: what's still owed on the last statement and when it's due (set a due day, or it's estimated at 25 days after close), plus how much extra to pay *before the statement closes* so a low balance (≤ your target, default 10%) gets reported. Counts known subscriptions due before close. 35-day timeline, one-click "Log payment", and a *Payment due* alert.
- **Points & miles** — cards earn cash back (%) or points (x per dollar). Points are valued at your own ¢/point, so a 3x card at 1.5¢ compares as 4.5% against cash-back cards everywhere (best-card, missed rewards, fee check).
- **Installable, offline, background alerts** — PWA (manifest, icons, offline app shell). The app mirrors its data to IndexedDB; the service worker runs the same alert engine via Periodic Background Sync and sends system notifications for rules with *Push* on. Background checks only work in Chromium-based browsers with the app installed (the browser decides how often); elsewhere alerts run whenever the app is open. Settings shows which case you're in and has *Run now*.
- **Insights** — rewards earned + missed (90 days), best card per category, detected subscriptions with price-change flags and annual cost, annual-fee worth-it, categories running hot vs. your usual month.
- **Cards** — credit/debit, 6 styles, limit + utilization, statement day, annual fee, base + bonus-category reward rates. Stores **last 4 digits only**.
- **Transactions** — add/edit/delete, search + filters, inline re-categorize, CSV import (column auto-detect, preview, dedupe) and export.
- **Auto-categorization** — merchant keywords + your own rules.
- **Budgets** — monthly per-category limits with pace-aware status.
- **Settings** — currency, theme, JSON backup/restore, erase.

## Structure

```
src/
  domain/      types.ts, categories.ts (categorize()), rewards.ts (best card / missed reward)
  store/       store.tsx (reducer + localStorage), seed.ts (demo data)
  lib/         payments (planner), pwa, idb, format, stats, csv, period (ranges/buckets/statement cycles), subscriptions, widgetData
  sw.ts        service worker: precache + background alert check
  alerts/      engine.ts (pure evaluate(state, today)), presets.ts, AlertForm.tsx
  widgets/     Widget.tsx (renderers), WidgetBuilder.tsx, presets.ts
  components/  CardVisual, BarChart, MonthlyBars, TransactionList, Modal
  forms/       CardForm, TransactionForm, ImportDialog
  views/       Dashboard, Cards, Transactions, Payments, Insights, Alerts, Budgets, Settings
```

## Extending

- New alert trigger → add a variant to `AlertTrigger` (`domain/types.ts`), a case in `evaluate()` + `describeTrigger()` (`alerts/engine.ts`), a default + fields in `AlertForm.tsx`. Return a stable `key` — that's what keeps it from firing twice.
- New widget type → add to `WidgetViz`, render it in `WidgetBody` (`widgets/Widget.tsx`), add a button in `WidgetBuilder.tsx`.

- New category → add id to `CategoryId` in `domain/types.ts`, entry in `CATEGORIES`, keywords in `BUILTIN`. Only 8 coloured slots exist (`--series-1..8`); extras should use `--series-other` or replace a slot.
- New state → add field to `AppState`, action to `Action` union + reducer case in `store/store.tsx`. Persisted automatically.
- Sync/backend → swap `load()` / the persist effect in `store/store.tsx` for an API.

## Notes

- The service worker only runs in a production build (`npm run build && npm run preview`), not `npm run dev`.
- Colors: low-glare palette (off-black / off-white backgrounds, softened text and status colors). Text tokens meet WCAG AA contrast; chart category colors use a colorblind-checked palette.
