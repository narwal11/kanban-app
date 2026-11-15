# Kanban App

Full-stack Kanban board with drag-and-drop, custom categories, and real-time sync. A React frontend talks to a Node/Express REST API, which reads and writes Supabase (Postgres). Socket.io pushes changes to every open browser, so edits show up in other tabs without a refresh.

## Features
- Drag-and-drop task management across To Do / In Progress / Done columns, with position tracking within each column
- Create, edit, and delete tasks with title, description, and category tag
- Custom categories with user-defined names and colors; renaming a category updates the tasks that use it
- Real-time sync across browsers and tabs via Socket.io
- Public read-only view; signing in (Supabase Auth) unlocks editing
- Request validation with Zod on every write
- Clear All function with confirmation

## Architecture

```
React (Vite)  --HTTP + Bearer JWT-->  Express API  --user's JWT-->  Supabase (Postgres + Auth)
     ^                                    |
     +-------- Socket.io "board:changed" -+
```

- **Frontend → API.** The React app loads and changes all board data through the Express API ([src/api.js](src/api.js)). It uses Supabase directly only for sign-in and sign-out.
- **JWT.** After signing in, the frontend sends the Supabase access token as `Authorization: Bearer <token>`. The API verifies it with `auth.getUser` and rejects missing or invalid tokens with 401.
- **Row Level Security applies.** For each authenticated request the API builds a Supabase client that forwards the caller's JWT, so Postgres RLS policies are evaluated as that user. `GET /api/board` uses the anonymous client, so it sees only what the `anon` role may read.
- **No service key.** The server uses only the public anon key. It never holds a `service_role` key, so it can't bypass RLS.
- **Real-time.** After every successful write the API emits `board:changed` over Socket.io to all connected clients. The client that made the change sends its socket id in an `X-Socket-Id` header and is skipped, since its UI is already up to date. Other clients reload the board. Clients also reload after a reconnect.

## API

Base URL: `http://localhost:3001` (set by `PORT`). Protected routes need `Authorization: Bearer <Supabase access token>`. Errors are JSON: `{ "error": "message" }`, and validation failures (400) include a `details` array.

| Method | Route | Auth | Body | Success response |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | — | 200 `{ status: "ok" }` |
| GET | `/api/board` | No | — | 200 `{ categories, tasks }` (categories by `created_at`, tasks by `order`) |
| DELETE | `/api/board` | Yes | — | 204 (deletes all tasks, then all categories) |
| POST | `/api/tasks` | Yes | `{ title, description?, tag?, status, order }` | 201 task |
| PATCH | `/api/tasks/reorder` | Yes | `[{ id, status, order }, ...]` (1–500 items) | 204 |
| PATCH | `/api/tasks/:id` | Yes | `{ title?, description?, tag? }` (at least one) | 200 task, 404 if not found |
| DELETE | `/api/tasks/:id` | Yes | — | 204 |
| POST | `/api/categories` | Yes | `{ name, color }` | 201 category, 409 if the name exists (case-insensitive) |
| PATCH | `/api/categories/:name` | Yes | `{ name?, color? }` (at least one) | 200 category, 404 if missing, 409 on rename clash; a rename also updates `tasks.tag` |
| DELETE | `/api/categories/:name` | Yes | — | 204 |

Field rules:
- `title`: trimmed, 1–200 characters. `description` and `tag` default to `""`.
- `status`: `todo`, `inprogress`, or `done`. `order`: integer ≥ 0.
- `name`: trimmed, 1–50 characters. `color`: hex like `#1a2b3c`.

## Getting Started

Requires Node.js and a Supabase project with `tasks` and `categories` tables, RLS policies, and at least one user created in Supabase Auth.

### 1. Configure environment

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Fill in your Supabase project URL and anon (publishable) key in both files. Never put a `service_role` key in either.

### 2. Run the server

```bash
cd server
npm install
npm run dev     # or: npm start
```

The API listens on `http://localhost:3001`.

### 3. Run the frontend

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). That origin must be listed in `CLIENT_ORIGIN` in `server/.env`.

### 4. Run the tests

```bash
cd server
npm test
```

The API tests use Vitest and Supertest with a mocked Supabase layer, so they need no network access or credentials. Lint the frontend and server from the repo root with `npm run lint`.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, @hello-pangea/dnd, socket.io-client
- **Backend:** Node.js, Express, Socket.io, Zod, cors, dotenv
- **Data and auth:** Supabase (Postgres, Auth, Row Level Security) via @supabase/supabase-js
- **Testing:** Vitest, Supertest
