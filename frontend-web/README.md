Front-end MVP (React + Vite)

Quick start:

1. Install dependencies

```bash
cd frontend-web
npm install
```

2. Run dev server

```bash
npm run dev
```

By default the SPA will call the backend at `http://localhost:8000`. To change this, set `VITE_API_BASE` in your environment.

E2E tests (Playwright)
-----------------------

This project includes a lightweight Playwright smoke test. To run it:

```bash
cd frontend-web
npm install
# install Playwright browsers (one-time)
npx playwright install

# run the e2e tests (ensure backend and vite are running)
npm run test:e2e
```

If you prefer not to install browsers locally, you can skip the Playwright step — the backend integration tests are available in the Django test suite.
