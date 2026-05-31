# Task Tracker API

A production-ready REST API for team-based task management with authentication, role-based access control, Redis caching, and containerized deployment.

---

## Quick Start

### Local development
1. Copy the local example environment file:
   - `copy .env.example .env.development`
2. Start PostgreSQL and Redis locally.
   - If you have Docker installed, run `npm run docker:up`
   - Otherwise start Redis on `127.0.0.1:6379` and Postgres on `127.0.0.1:5432`
3. Run the API in development mode:
   - `npm run dev`
4. Verify local services before starting if needed:
   - `npm run check:services`

### Local development with Docker
1. Copy `.env.example` to `.env.development`.
2. Start local DB services:
   - `npm run docker:up`
   - This helper will detect Docker and WSL Docker on Windows.
   - If Docker is not installed, it prints install instructions and will not start services.
   - On Windows, install Docker Desktop if you want this workflow.
3. Run the API:
   - `npm run dev`
4. Stop local containers:
   - `npm run docker:down`

### Docker deployment
1. Use Docker Compose to start all services:
   - `docker compose up --build`
2. The API will use Docker service hostnames from `.env`.

---

## API Documentation

### Swagger/OpenAPI
Once the API is running, view the interactive API docs at:
- `http://localhost:3000/api-docs`

### Postman Collection
Import `TaskTracker.postman_collection.json` into Postman. The collection includes:
- Pre-configured auth flows
- All CRUD endpoints
- Pre-seeded demo accounts
- Automatic token management

**Demo Users** (seeded in the database):
| Email                | Password      | Role   |
|----------------------|---------------|--------|
| admin@acme.com       | Password123!  | ADMIN  |
| manager@acme.com     | Password123!  | MANAGER|
| member@acme.com      | Password123!  | MEMBER |

---

## Caching Strategy

### Approach
- **Redis per-assignee task cache**: Tasks are cached per `(organization_id, assignee_id)` to minimize repeated queries in typical workflows where users review "my tasks" repeatedly.
- **Short TTL for single task**: Individual task lookups are cached for 1 minute to support detail views.
- **Search queries not cached**: Full-text search and large paginated results bypass the cache to avoid cache bloat.

### Invalidation
Cache is invalidated on:
1. **Task creation**: Org-level task list cache is cleared.
2. **Task update**: Single task cache + assignee's task list cache are cleared.
3. **Task deletion**: All related caches are cleared.
4. **Status transition**: Task cache is cleared and task history is logged (audit trail).

**Design rationale**: We use a pattern-based invalidation approach. When a task is updated, we clear:
- The individual task cache (`tasks:{taskId}`)
- The assignee's task list (`tasks:org:{orgId}:assignee:{assigneeId}`)
- Any org-level list caches

This ensures consistency without requiring complex distributed cache invalidation.

---

## Database Design Decisions

### Composite Index on `(organization_id, status, assignee_id)`
**Decision**: Created a composite index on tasks for the most common query pattern: listing tasks by organization, filtered by status and assignee.

**Rationale**:
- Users frequently query "my tasks in progress" or "show all TODO items for assignee X."
- Single-column indexes on `status`, `assignee_id`, and `due_date` handle independent filters.
- The composite index accelerates the frequent combined filter (`WHERE org_id = ? AND status = ? AND assignee_id = ?`).
- Prevents costly full table scans on large task tables.

**Alternative rejected**: Separate indexes on each column. We chose composite because the filter combination is the dominant access pattern in task board UI workflows.

### UUID Primary Keys
**Decision**: Use PostgreSQL UUID (gen_random_uuid) instead of auto-incrementing integers.

**Rationale**:
- Eliminates integer enumeration attacks (attackers cannot guess task IDs).
- Supports distributed ID generation if the system scales horizontally.
- Improves security profile for a team collaboration tool handling potentially sensitive work.

---

## Features

### Core
- ✅ **Authentication**: JWT access + refresh token rotation with token revocation.
- ✅ **Role-Based Access Control (RBAC)**: Middleware-level enforcement for ADMIN, MANAGER, MEMBER roles.
- ✅ **Task CRUD**: Full Create, Read, Update, Delete with role-based permissions.
- ✅ **Status Transitions**: Server-side enforced state machine (TODO → IN_PROGRESS → IN_REVIEW → DONE, with BLOCKED as an escape valve).
- ✅ **Pagination & Filtering**: List tasks with page, limit, status, priority, assignee filters.
- ✅ **Redis Caching**: Per-assignee task caching with strategic invalidation.
- ✅ **Input Validation**: Joi schemas on all endpoints with meaningful error messages.
- ✅ **Error Handling**: Consistent JSON error responses across all endpoints.
- ✅ **Docker Deployment**: Full containerization with docker-compose.

### Bonus
- ✅ **Analytics Endpoint** (`GET /api/v1/tasks/analytics`): Overdue task counts per user + average completion time.
- ✅ **Task Status History**: Audit trail of all status transitions with user and timestamp.
- ✅ **Postman Collection**: Pre-configured with auth and all endpoints.
- ✅ **Unit & Integration Tests**: 41 tests covering validation, RBAC, and transitions.

---

## What Would Improve with More Time

### 1. Frontend (React / Next.js)
A task board UI would complete the picture:
- Kanban-style board (drag/drop between columns)
- Real-time task updates (WebSocket or Server-Sent Events)
- User profile & role management dashboard
- Analytics dashboard with charts

### 2. Real-Time Notifications
Implement WebSocket or Server-Sent Events (SSE) to:
- Notify users when a task assigned to them changes status.
- Show live updates when teammates update shared tasks.
- Broadcast org-wide announcements.

### 3. Advanced Permission Granularity
- Project-level role inheritance (e.g., "Project Lead" can manage only their project).
- Custom permission scopes per role.
- Audit log for all user actions (who created/modified/deleted what).

### 4. Batch Operations
- Bulk task updates (reassign multiple tasks to a user).
- Bulk status transitions (move multiple tasks to "IN_REVIEW").
- CSV export of task lists.

### 5. Database Optimization
- Materialized views for analytics queries (pre-compute overdue counts).
- Partitioning tasks table by organization for multi-tenant scalability.
- Read replicas to offload analytics queries.

### 6. Performance & Security
- Rate limiting per user (not global).
- API key authentication for service-to-service calls.
- Request logging & monitoring (Prometheus metrics).
- Distributed tracing (Jaeger / OpenTelemetry).

### 7. Search Enhancements
- Full-text search on task titles and descriptions using PostgreSQL FTS.
- Fuzzy matching for typo tolerance.
- Search result ranking by relevance.

---

## Testing

Run all tests:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

Test suites cover:
- Input validation schemas
- RBAC middleware and role hierarchy
- Task status transitions
- Permission enforcement in controllers

---

## Project Structure

```
src/
├── config/          # Database, Redis, Swagger config
├── controllers/     # Request handlers
├── middleware/      # Auth, RBAC, validation, error handling
├── routes/          # API route definitions
├── services/        # Business logic (task, auth, user, project)
├── utils/           # Helpers (JWT, logging, transitions, response formatting)
├── validators/      # Joi schemas for input validation
└── __tests__/       # Test suites
```

---

## Environment Variables

See `.env.example` for all available variables:
- `NODE_ENV`: development | production
- `PORT`: API server port (default: 3000)
- `DB_*`: PostgreSQL connection details
- `REDIS_*`: Redis connection details
- `JWT_*`: JWT secret and expiration times
- `CACHE_TTL`: Redis cache TTL in seconds (default: 300)

---

## Troubleshooting

### Docker services won't start
- Ensure Docker Desktop is running.
- Check for port conflicts (3000, 5432, 6379).
- Run `docker compose down` and `docker compose up --build` again.

### Tests fail
- Ensure all dependencies are installed: `npm install`
- Check that test environment is clean: `npm test -- --clearCache`

### Redis cache not working
- Check Redis logs: `docker compose logs redis`
- Verify `REDIS_HOST` and `REDIS_PORT` in `.env`.
- The API gracefully degrades if Redis is unavailable (caching disabled).
