# Frontend

React 19, TypeScript, Vite, Tailwind CSS, React Router and Axios.

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api and /media to Django on :8000)
npm test           # unit tests (Vitest)
npm run build      # type-check and production build into dist/
node e2e/smoke.mjs # end-to-end smoke test against the running dev servers (needs Playwright)
```

- `src/api/` — HTTP client (token refresh on 401), typed endpoints and response types.
- `src/auth/` — sign-in state and route guards.
- `src/pages/` — one file per screen. `src/components/` — shared UI, cards, filters, gallery.
- `src/lib/` — formatting (TZS, km, dates), search filters stored in the URL, regions and choices.
