# User Management System - Documentation

## Overview

Complete user management system with RBAC (Role-Based Access Control) for the VMS Backend.

## Features Implemented

### ✅ User Controller (`src/controllers/users.ts`)

- **List Users** - Paginated user listing with filtering
- **Create User** - Create system users with role assignment
- **Get User** - Retrieve user details with roles
- **Update User** - Modify user information
- **Deactivate User** - Soft delete users
- **Assign Roles** - Add roles to users
- **Remove Role** - Remove specific roles from users

### ✅ RBAC Middleware (`src/middleware/rbac.ts`)

- **Permission-based access control** with caching
- `requirePermissions(...permissions)` - Require ALL specified permissions
- `requireAnyPermission(...permissions)` - Require ANY of the specified permissions
- `requireRole(...roles)` - Require specific roles
- **In-memory permission caching** (60-second TTL)
- Cache management functions

### ✅ User Routes (`src/routes/users.ts`)

All routes require authentication and specific permissions:

| Method | Endpoint                       | Permission           | Description     |
| ------ | ------------------------------ | -------------------- | --------------- |
| GET    | `/api/users`                   | `users:read`         | List all users  |
| POST   | `/api/users`                   | `users:create`       | Create new user |
| GET    | `/api/users/:id`               | `users:read`         | Get user by ID  |
| PUT    | `/api/users/:id`               | `users:update`       | Update user     |
| DELETE | `/api/users/:id`               | `users:delete`       | Deactivate user |
| PUT    | `/api/users/:id/roles`         | `users:assign-roles` | Assign roles    |
| DELETE | `/api/users/:id/roles/:roleId` | `users:assign-roles` | Remove role     |

### ✅ Validation Schemas (`src/types/schemas.ts`)

- **createUserSchema** - Validate user creation with strong password requirements
- **updateUserSchema** - Validate user updates
- **assignRolesSchema** - Validate role assignments
- **listUsersQuerySchema** - Validate query parameters for user listing

### ✅ Audit Logging (`src/utils/auditLog.ts`)

Comprehensive audit logging for:

- User creation
- User updates
- User deactivation
- Role assignments/removal
- Login/logout events
- Failed login attempts
- Security events

## API Usage Examples

### 1. List Users

```http
GET /api/users?search=john&role=admin&isActive=true&limit=25&offset=0
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "john@example.com",
      "employeeId": "uuid",
      "isActive": true,
      "mfaEnabled": false,
      "roles": [
        {
          "id": "uuid",
          "name": "Admin",
          "slug": "admin"
        }
      ],
      "createdAt": "2025-10-19T..."
    }
  ],
  "pagination": {
    "count": 1,
    "limit": 25,
    "offset": 0
  }
}
```

### 2. Create User

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeId": "employee-uuid",
  "email": "newuser@example.com",
  "password": "SecureP@ssw0rd!",
  "roleIds": ["role-uuid-1", "role-uuid-2"],
  "organizationId": "org-uuid",
  "mfaEnabled": false
}
```

**Password Requirements:**

- Minimum 10 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### 3. Update User

```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "updated@example.com",
  "mfaEnabled": true,
  "isActive": true
}
```

### 4. Assign Roles

```http
PUT /api/users/:id/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleIds": ["role-uuid-1", "role-uuid-2"]
}
```

### 5. Remove Role

```http
DELETE /api/users/:id/roles/:roleId
Authorization: Bearer <token>
```

### 6. Deactivate User

```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

## RBAC Implementation

### Using Permission Middleware

```typescript
import {
  requirePermissions,
  requireAnyPermission,
  requireRole,
} from "../middleware/rbac";

// Require specific permissions (AND logic)
router.get("/admin", requirePermissions("admin:read", "admin:write"), handler);

// Require any permission (OR logic)
router.get(
  "/dashboard",
  requireAnyPermission("dashboard:read", "reports:read"),
  handler
);

// Require specific role
router.get("/superadmin", requireRole("super_admin"), handler);
```

### Permission Cache

- **TTL:** 60 seconds
- **Storage:** In-memory Map
- **Functions:**
  - `clearPermissionCache(userId)` - Clear cache for specific user
  - `clearAllPermissionCaches()` - Clear all caches

For production, consider replacing with Redis for distributed caching.

## Required Permissions

Ensure these permissions exist in your database:

- `users:read` - View users
- `users:create` - Create new users
- `users:update` - Update user information
- `users:delete` - Deactivate users
- `users:assign-roles` - Manage user roles

## Security Features

1. **Strong Password Requirements**

   - Enforced via Zod schema validation
   - Minimum complexity requirements

2. **Sensitive Data Protection**

   - Password hashes never returned in responses
   - MFA secrets excluded from API responses

3. **Audit Logging**

   - All user operations logged
   - IP address tracking
   - User attribution

4. **Soft Delete**

   - Users are deactivated, not deleted
   - Preserves audit trail

5. **Permission-based Access**
   - Fine-grained access control
   - Role inheritance through permissions

## Database Schema Requirements

### System Users Table

- `id` - UUID primary key
- `employeeId` - UUID foreign key to employees
- `email` - Unique email address
- `passwordHash` - Hashed password
- `saltHash` - Password salt
- `isActive` - Boolean status
- `mfaEnabled` - MFA flag
- `organizationId` - Organization reference
- `createdAt`, `updatedAt` - Timestamps

### User Roles Junction Table

- `userId` - Reference to system_users
- `roleId` - Reference to roles

### Roles Table

- `id` - UUID
- `name` - Role display name
- `slug` - URL-safe identifier
- `organizationId` - Organization reference

### Role Permissions Junction Table

- `roleId` - Reference to roles
- `permissionId` - Reference to permissions

### Permissions Table

- `id` - UUID
- `slug` - Permission identifier (e.g., "users:read")
- `name` - Display name
- `resource` - Resource type
- `action` - Action type

## Testing

### Example Test Flow

1. Create test employee
2. Create system user for that employee
3. Create roles with permissions
4. Assign roles to user
5. Test API endpoints with JWT token
6. Verify RBAC permissions

### Sample cURL Commands

```bash
# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "employee-uuid",
    "email": "test@example.com",
    "password": "SecureP@ssw0rd!123",
    "roleIds": ["role-uuid"]
  }'

# List users
curl -X GET "http://localhost:3000/api/users?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update user
curl -X PUT http://localhost:3000/api/users/user-uuid \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mfaEnabled": true
  }'
```

## Next Steps

1. **Implement Email Service** - For password reset notifications
2. **Add Redis Caching** - Replace in-memory permission cache
3. **Implement Rate Limiting** - Per-user rate limits
4. **Add User Activity Tracking** - Last login, session management
5. **Implement MFA** - Complete 2FA implementation
6. **Add Bulk Operations** - Bulk user import/export
7. **Implement User Groups** - Group-based permissions
8. **Add API Documentation** - OpenAPI/Swagger specs

## Troubleshooting

### Common Issues

**Issue:** Permission denied errors

- **Solution:** Check user has required role with correct permissions in database

**Issue:** User creation fails with "Employee does not exist"

- **Solution:** Ensure employee record exists before creating system user

**Issue:** Email already in use

- **Solution:** Email must be unique across all system users

**Issue:** Weak password error

- **Solution:** Ensure password meets all complexity requirements

## Files Modified/Created

- ✅ `src/controllers/users.ts` - User management controller
- ✅ `src/routes/users.ts` - User API routes
- ✅ `src/middleware/rbac.ts` - RBAC middleware
- ✅ `src/types/schemas.ts` - Updated with user schemas
- ✅ `src/utils/auditLog.ts` - Audit logging utility
- ✅ `src/app.ts` - Registered users routes

## Status: ✅ Complete & Ready for Testing
