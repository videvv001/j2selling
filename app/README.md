# J2 AutoHaus: car acquisition app

React + Vite + TypeScript implementation of the Claude Design prototype in `../project` (Modernist design system). It covers the public website, the 6-step Sell My Car form, sign-in, the customer portal and the admin operations portal.

Data is mock data held in a client-side store. It is saved to `localStorage` and mirrored to a tiny Node backend (`server/index.js`) that keeps the state in SQLite (`server/data.db`, created on first run). Needs Node >= 22.13 (uses built-in `node:sqlite`, no extra deps). If the backend is down the app falls back to `localStorage`.

## Run

```bash
npm install
npm run dev        # frontend http://localhost:5173 + API on :3001
npm start          # build, then serve app + API on http://localhost:3001
npm run build      # typecheck + production build to dist/
npm run preview
```

## Configuration

- **Brand**: `src/config.ts` (`BRAND.name`, `legalName`, `domain`, contact details). Staff emails, the SEO title suffix, the article URL prefix and the footer all read from here.
- **Demo mode**: set `VITE_DEMO_MODE=false` (see `.env.example`) to hide the dark prototype bar (area switcher, quick logins, "Jump demo to…", demo script, reset) and the other demo shortcuts: "Fill with demo car", "Simulate all uploads", "Sign in as Juan (demo)", the sign-in page's prototype shortcuts, and image-slot uploads on marketing imagery. Demo mode is on by default.

## Structure

```
src/
  config.ts              brand + demo flag
  routes.ts              URL ⇄ { area, page, params } mapping
  App.tsx                shell: routing, demo bar, toasts, confirm dialog
  store/                 domain model, seed data, actions, analytics (ported from project/store.js)
  components/            Chart (bar/line/hbar), ImageSlot
  screens/public/        Marketing, SellWizard, Auth
  screens/customer/      CustomerPortal
  screens/admin/         AdminPortal (shell + inbox), Dashboard, Submissions (queues), Workspace (case),
                         Customers, CMS, Reports, Team (staff/logs/settings)
  styles/modernist.css   design system, copied unchanged
  styles/app.css         globals + hover utilities
```

Screens keep the prototype's inline style declarations via `sx('…')`, which parses a CSS string into a cached React style object, so layout can be diffed line by line against `project/*.dc.html`.

## URLs

| Area | Paths |
| --- | --- |
| Public | `/`, `/sell-my-car`, `/how-it-works`, `/articles`, `/articles/:id`, `/faq`, `/contact`, `/sell`, `/sell/submitted`, `/signin`, `/register`, `/forgot-password`, `/reset-password`, `/staff-login` |
| Customer | `/account`, `/account/cars`, `/account/vehicle/:id?tab=offer`, `/account/messages`, `/account/notifications`, `/account/profile` |
| Admin | `/admin`, `/admin/submissions` (also `valuations`, `offers`, `inspections`, `sales`), `/admin/workspace/:id?tab=…`, `/admin/customers`, `/admin/customer/:id`, `/admin/messages`, `/admin/articles`, `/admin/article-edit/:id`, `/admin/reports`, `/admin/staff`, `/admin/logs`, `/admin/settings` |

The SPA needs a host that serves `index.html` for unknown paths (e.g. Netlify/Vercel rewrites).

## Differences from the prototype

- Pages have real URLs, so back/forward and deep links work.
- All dates and times display in Manila time (UTC+8) regardless of the viewer's timezone.
- The demo clock (starting Sep 29 2026, 10:30) now keeps running across page reloads. In the prototype it restarted on every load, so offers created after a refresh could sort before older ones.
- Pending saves are flushed when the page unloads, so a quick refresh no longer loses the last action.
- The portals are code-split and load on demand.
