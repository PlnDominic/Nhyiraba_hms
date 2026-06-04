# Repository Guidelines

## Project Structure & Module Organization

- Root backend and tooling
  - server.js – Express API exposing /api endpoints (rooms, reservations)
  - build.js, vercel-build.js – build orchestration for deployments
  - SQL and JS scripts for Supabase schema/RLS under root (*.sql, *.js)
  - docs: multiple README-*.md and guides for setup, fixes, and reporting
- Frontend (CRA via CRACO): client/
  - client/src – React app code and UI
  - client/public – static assets
  - client/package.json – frontend scripts/deps
- Shared top-level React app: src/
  - src/index.js, App.js, components, hooks, services, api
- Additional directories: scripts/, db_scripts/, server/ (auxiliary), supabase/ (keys/setup docs), public/

## Build, Test, and Development Commands

```bash
# Start full-stack dev (root): Express API + React dev server
npm run dev

# Backend only
node server.js

# Frontend dev only
cd client && npm run react-start

# Build production (root orchestrator)
npm run build

# Build frontend only
cd client && npm run build

# Run client tests
cd client && npm test
```

## Coding Style & Naming Conventions

- Indentation: 2 spaces (JavaScript/React/Node)
- File naming: PascalCase for React components (e.g., src/components/ErrorBoundary.jsx), camelCase for utilities (e.g., supabaseClient.js), kebab-case for config files (tailwind.config.js, postcss.config.js)
- Functions/variables: camelCase; React components in PascalCase
- Linting/formatting: CRA defaults; .eslintignore present at root and client

## Testing Guidelines

- Framework: Jest + React Testing Library (via CRA/craco)
- Test files: *.test.js colocated with source (e.g., src/App.test.js)
- Running tests: cd client && npm test
- Coverage: no explicit thresholds configured

## Commit & Pull Request Guidelines

- Commit messages: use clear, descriptive messages; conventional style recommended
  - Examples: "feat(api): add price filters to rooms", "fix(rls): correct invoice policy"
- PRs: include summary of changes, testing evidence if applicable; request review from maintainers
- Branch naming (suggested): feature/<scope>, fix/<scope>, chore/<scope>

---

# Repository Tour

## 🎯 What This Repository Does

Nhyiraba HMS is a full-stack hotel management system with a React frontend and an Express API that integrates with Supabase for data storage and row-level security policies.

**Key responsibilities:**
- Serve REST API endpoints for rooms and reservations
- Provide a React-based management dashboard/UI
- Manage Supabase schema, RLS policies, and maintenance scripts

---

## 🏗️ Architecture Overview

### System Context
```
User (browser) → React SPA (client/src or src/) → Express API (server.js) → Supabase (Postgres + Auth/RLS)
```

### Key Components
- Express API (server.js) – Hosts /api endpoints; initializes Supabase client using env vars
- React SPA (client/src and top-level src/) – App shell, routing, error boundary, pages/components
- Supabase scripts (root/client *.sql, JS utilities) – Schema creation, migrations, and RLS/policy fixes
- Build Tooling (CRACO, Tailwind, PostCSS) – Frontend build and styling pipeline

### Data Flow
1. User interacts with React UI
2. UI calls Express endpoints (e.g., GET /api/rooms, /api/reservations)
3. Express queries Supabase via @supabase/supabase-js with optional filters and ordering
4. JSON response returns to UI; components render updated state

---

## 📁 Project Structure [Partial Directory Tree]

```
Nhyiraba HMS/
├── server.js                 # Express API server (rooms/reservations endpoints)
├── package.json              # Root scripts: dev/build; express and supabase deps
├── build.js                  # Root build orchestrator
├── client/                   # CRA-based frontend configured via CRACO
│   ├── package.json          # Frontend scripts (start, build, test)
│   ├── src/                  # React UI code
│   └── public/               # Static assets and index.html
├── src/                      # Top-level React app (shared/common UI)
│   ├── index.js              # Entry: BrowserRouter + ErrorBoundary + web vitals
│   ├── App.js                # Main SPA component
│   ├── components/           # Shared UI components
│   └── services/             # supabaseClient.js and helpers
├── scripts/                  # Utility scripts (if present)
├── db_scripts/               # DB helpers and SQL
├── public/                   # Public assets (root)
├── supabase/                 # Keys/setup docs
└── *.sql, README-*.md        # Supabase schema, RLS fixes, guides
```

### Key Files to Know

| File | Purpose | When You'd Touch It |
|------|---------|---------------------|
| server.js | Express API endpoints; Supabase client init | Add/modify API routes or CORS/security settings |
| package.json | Root scripts and backend deps | Change dev/build orchestration or add backend libs |
| client/package.json | Frontend scripts/deps | Adjust UI dependencies or start/build/test commands |
| src/index.js | React entry, Router, ErrorBoundary, web vitals | Update routing base or error handling |
| src/App.js | Main SPA shell | Add global providers/layout |
| src/services/supabaseClient.js | Supabase client for frontend | Configure client-side Supabase usage |
| tailwind.config.js, postcss.config.js | Styling pipeline | Tweak theme, plugins, and scanning paths |
| build.js, vercel-build.js | Build/deploy | Modify CI/Vercel build behavior |

---

## 🔧 Technology Stack

### Core Technologies
- Language: JavaScript/Node.js
- Frontend: React (CRA via CRACO)
- Backend: Express
- Database/Backend: Supabase (Postgres + RLS)
- Styling: Tailwind CSS + PostCSS

### Key Libraries
- @supabase/supabase-js – Supabase client and queries
- react-router-dom – Client-side routing
- Testing Library + Jest – Component/app testing (CRA defaults)
- echarts, jspdf, xlsx – Reporting and export utilities

### Development Tools
- @craco/craco – CRA configuration customization
- concurrently – Run API and client together in dev
- Tailwind/PostCSS/Autoprefixer – CSS tooling

---

## 🌐 External Dependencies

- Supabase – Primary datastore and auth/RLS engine. Critical to app operation.

### Environment Variables

```bash
# Server (root .env)
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Client (client/.env)
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

---

## 🔄 Common Workflows

### Local Development
1. Populate root .env and client/.env with Supabase credentials
2. Start both servers: npm run dev (root)
3. Visit client dev server; API runs on PORT (default 5000)

Code path: client/src → HTTP → server.js (/api) → Supabase

### Database Setup & RLS Fixes
- Apply schema and policy scripts under root and client/db_scripts
- Use guides like README-RLS-FIX.md, SUPABASE_SETUP.md for order and caveats

---

## 📈 Performance & Scale

- API endpoints support filtering (status/type/price) and ordering to reduce payloads
- CRA build via CRACO for production; Tailwind utility classes reduce CSS bloat

---

## 🚨 Things to Be Careful About

### 🔒 Security Considerations
- Do not expose SUPABASE_SERVICE_KEY in any client-facing code/env
- CORS is currently permissive (Access-Control-Allow-Origin: *); restrict origins for production
- Maintain strict RLS policies; numerous fix scripts are provided in the repo


*Updated at: 2025-11-09 (UTC)*
