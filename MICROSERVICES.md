# Microservices Architecture Guide

This document describes how the VMS (Visitor Management System) backend can be evolved from its current monolithic architecture into a microservices system.

---

## Current Architecture

The application is a **monolith** — a single Express.js process that handles all concerns:

```
vms-backend (single process)
├── Auth          (login, JWT, refresh)
├── Users         (CRUD, role assignment)
├── Visitors      (CRUD, blacklist)
├── Organizations (multi-tenant management)
├── Roles         (RBAC)
├── Permissions   (granular access control)
└── Database      (single PostgreSQL via pg pool)
```

This works well at low-to-medium scale. A microservices split makes sense when:
- Different parts of the system need to **scale independently**
- Teams need to **own and deploy** separate services
- Individual components need **different tech stacks or SLAs**

---

## Proposed Service Decomposition

```
                          ┌─────────────────┐
                          │   API Gateway    │
                          │  (Nginx / Kong)  │
                          └────────┬────────┘
                                   │
          ┌──────────┬─────────────┼────────────┬──────────────┐
          │          │             │            │              │
    ┌─────▼────┐ ┌───▼───┐ ┌──────▼─────┐ ┌───▼────┐ ┌───────▼──────┐
    │   Auth   │ │ Users │ │  Visitors  │ │ Visits │ │    Orgs &    │
    │ Service  │ │Service│ │  Service   │ │Service │ │  RBAC Service│
    └──────────┘ └───────┘ └────────────┘ └────────┘ └──────────────┘
          │          │             │            │              │
          └──────────┴─────────────┴────────────┴──────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  Message Broker     │
                         │  (RabbitMQ / Kafka) │
                         └─────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             ┌──────▼──────┐            ┌─────────▼────────┐
             │   Audit &   │            │  Notifications   │
             │  Logging    │            │    Service       │
             │  Service    │            │ (email, SMS, etc)│
             └─────────────┘            └──────────────────┘
```

---

## Service Definitions

### 1. Auth Service
**Responsibility:** Authentication only — token issuance, refresh, and revocation.

**Endpoints:**
```
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/verify         (internal — validates tokens for other services)
```

**Database:** Owns `system_users`, `authentication_tokens` tables.

**Why separate:** Auth is a cross-cutting concern. Every service calls it to validate tokens. It has very different scaling needs (high read, low write) and must never go down.

---

### 2. User Service
**Responsibility:** User and employee profile management, role assignment.

**Endpoints:**
```
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
POST   /users/:id/roles
DELETE /users/:id/roles/:roleId
```

**Database:** Owns `employees`, `user_roles` tables. Reads from `roles` (shared or via API call to RBAC Service).

**Publishes events:**
- `user.created`
- `user.updated`
- `user.deactivated`

---

### 3. Visitor Service
**Responsibility:** Visitor profile management, watchlist, blacklist.

**Endpoints:**
```
GET    /visitors
POST   /visitors
GET    /visitors/:id
PUT    /visitors/:id
DELETE /visitors/:id
POST   /visitors/:id/blacklist
DELETE /visitors/:id/blacklist
GET    /visitors/:id/visits
```

**Database:** Owns `visitors`, `visitor_identification`, `visitor_photos`, `watchlist` tables.

**Publishes events:**
- `visitor.created`
- `visitor.blacklisted`
- `visitor.watchlist_hit`

---

### 4. Visit Service
**Responsibility:** Visit lifecycle — scheduling, check-in, check-out, status transitions.

**Endpoints:**
```
GET    /visits
POST   /visits
GET    /visits/:id
PUT    /visits/:id
PATCH  /visits/:id/status
POST   /visits/:id/checkin
POST   /visits/:id/checkout
GET    /visits/:id/history
```

**Database:** Owns `appointments`, `visits`, `visit_status_history`, `access_logs`, `visit_documents` tables.

**Publishes events:**
- `visit.scheduled`
- `visit.checked_in`
- `visit.checked_out`
- `visit.cancelled`

**Subscribes to:**
- `visitor.blacklisted` — cancels pending visits for blacklisted visitors

---

### 5. Organization & RBAC Service
**Responsibility:** Multi-tenant organization management, locations, roles, and permissions.

**Endpoints:**
```
GET    /organizations
POST   /organizations
GET    /organizations/:id
PUT    /organizations/:id
DELETE /organizations/:id

GET    /locations
POST   /locations
...

GET    /roles
POST   /roles
PUT    /roles/:id/permissions
...

GET    /permissions
POST   /permissions
...
```

**Database:** Owns `organizations`, `locations`, `access_points`, `roles`, `permissions`, `role_permissions` tables.

**Note:** All other services call this service (or a cached replica) to resolve permissions.

---

### 6. Audit & Logging Service
**Responsibility:** Centralized audit trail. Consumes events from all services and writes to audit log.

**No public endpoints** (internal writes only). Read endpoints for admin:
```
GET /audit-logs
GET /audit-logs/:id
```

**Database:** Owns `audit_logs` table. Append-only.

**Subscribes to:** All events from all services.

---

### 7. Notification Service
**Responsibility:** Outbound communications — email, SMS, push notifications.

**No public write endpoints.** Admin read:
```
GET /notifications/history
```

**Subscribes to:**
- `visit.scheduled` → sends confirmation to visitor and host
- `visit.checked_in` → notifies host
- `visitor.watchlist_hit` → alerts security team

---

## Inter-Service Communication

### Synchronous (REST/gRPC)
Used when the caller needs an immediate response:
- API Gateway → Services (all user-facing requests)
- Services → Auth Service (token validation)
- Services → RBAC Service (permission checks)

### Asynchronous (Message Broker)
Used for side effects that don't need to block the response:
- Visit check-in → Audit log entry
- Visitor blacklisted → Cancel pending visits
- Visit scheduled → Send notification email

**Recommended broker:** RabbitMQ for small deployments, Kafka for high-throughput audit logging.

---

## Shared Infrastructure

| Component | Purpose | Recommendation |
|---|---|---|
| **API Gateway** | Routing, auth token validation, rate limiting | Nginx + custom middleware, or Kong |
| **Service Registry** | Service discovery | Consul or Kubernetes DNS |
| **Config Store** | Centralized env vars / secrets | HashiCorp Vault or AWS Secrets Manager |
| **Cache** | Session data, permission caching | Redis |
| **Message Broker** | Async events | RabbitMQ or Kafka |
| **Tracing** | Distributed request tracing | Jaeger or OpenTelemetry |
| **Metrics** | Per-service health and throughput | Prometheus + Grafana |

---

## Database Strategy

Each service owns its data. Two viable approaches:

### Option A: Database per service (recommended for true isolation)
Each service gets its own PostgreSQL database or schema. No direct cross-service SQL joins.

```
auth_db        → system_users, authentication_tokens
user_db        → employees, user_roles
visitor_db     → visitors, watchlist, visitor_photos
visit_db       → visits, appointments, access_logs
org_db         → organizations, locations, roles, permissions
audit_db       → audit_logs
```

### Option B: Shared database, separate schemas (easier migration from monolith)
One PostgreSQL instance, one schema per service. Simpler to operate but less isolated.

```
vms_db
├── auth.*
├── users.*
├── visitors.*
├── visits.*
├── orgs.*
└── audit.*
```

---

## Migration Path from Monolith

Migrate incrementally using the **Strangler Fig pattern** — carve out one service at a time without a big-bang rewrite.

### Phase 1 — Extract Auth Service
Auth is the highest-value extraction: it's stateless, well-defined, and everything depends on it.
1. Deploy standalone Auth Service
2. Route `/api/auth/*` through API Gateway to new service
3. Other routes still hit the monolith
4. Monolith calls Auth Service for token validation instead of doing it inline

### Phase 2 — Extract Audit & Logging
The monolith publishes events to a message broker. Audit Service subscribes and writes to `audit_logs`. The monolith can stop writing audit logs directly.

### Phase 3 — Extract Visitor Service
Visitor data is mostly self-contained with few dependencies. Good second extraction.

### Phase 4 — Extract Visit Service
Depends on Visitor Service being stable. Extract once Phase 3 is solid.

### Phase 5 — Extract Organization & RBAC Service
Most complex due to cross-service reads. Extract last.

---

## Docker Compose for Local Microservices Dev

```yaml
# docker-compose.microservices.yml (example)
services:
  api-gateway:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf

  auth-service:
    build: ./services/auth
    environment:
      DATABASE_URL: postgresql://vms:vms_password@postgres-auth:5432/auth_db

  visitor-service:
    build: ./services/visitor
    environment:
      DATABASE_URL: postgresql://vms:vms_password@postgres-visitor:5432/visitor_db

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"   # management UI

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## When NOT to Use Microservices

Microservices add **significant operational complexity**:
- Every service needs its own CI/CD pipeline
- Distributed tracing is required to debug cross-service issues
- Network latency between services adds up
- Data consistency across services is harder (no cross-service transactions)

**Stay with the monolith if:**
- The team is small (< 5 engineers)
- Traffic is under ~5,000 concurrent users on a properly scaled monolith
- You don't have separate teams owning separate features

The current VMS monolith, properly deployed with horizontal scaling (multiple containers behind a load balancer) and a connection pool tuned to the DB, can comfortably handle thousands of concurrent users before microservices become necessary.
