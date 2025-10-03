import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  varchar,
  serial,
} from "drizzle-orm/pg-core";

// Enums
export const visitStatusEnum = pgEnum("visit_status", [
  "scheduled",
  "pending_approval",
  "approved",
  "checked_in",
  "in_progress",
  "checked_out",
  "completed",
  "no_show",
  "cancelled",
  "rejected",
]);

export const visitTypeEnum = pgEnum("visit_type", [
  "meeting",
  "delivery",
  "interview",
  "maintenance",
  "contractor",
  "vendor",
  "guest",
  "other",
]);

export const accessLogActionEnum = pgEnum("access_log_action", [
  "entry_attempt",
  "entry_granted",
  "entry_denied",
  "exit_attempt",
  "exit_granted",
  "exit_denied",
]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "active",
  "archived",
  "expired",
]);

export const tokenTypeEnum = pgEnum("token_type", [
  "access",
  "refresh",
  "password_reset",
  "email_verification",
  "mfa",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "read",
  "update",
  "delete",
  "login",
  "logout",
  "check_in",
  "check_out",
  "approve",
  "reject",
  "escalate",
]);

// =============================================================================
// ORGANIZATIONS & LOCATIONS
// =============================================================================

// Multi-tenant root entity
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  domain: text("domain").unique(), // email domain for SSO
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  logo: text("logo"), // URL to logo
  timezone: text("timezone").default("UTC"),
  settings: jsonb("settings").default({}), // Organization-specific settings
  subscriptionTier: text("subscription_tier").default("basic"), // basic, premium, enterprise
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Physical sites/offices per organization
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  code: varchar("code", { length: 20 }), // Building/site code
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state"),
  country: text("country").notNull().default("US"),
  postalCode: text("postal_code"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  timezone: text("timezone").default("UTC"),
  description: text("description"),
  capacity: integer("capacity"),
  operatingHours: jsonb("operating_hours"), // Business hours
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Doors, gates, checkpoints
export const accessPoints = pgTable("access_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id")
    .references(() => locations.id)
    .notNull(),
  name: text("name").notNull(), // "Main Entrance", "Employee Gate", etc.
  type: text("type").notNull(), // door, gate, turnstile, checkpoint
  description: text("description"),
  hardwareId: text("hardware_id"), // Physical device ID
  securityLevel: integer("security_level").default(1), // 1-5 scale
  requiresBadge: boolean("requires_badge").default(true),
  requiresEscort: boolean("requires_escort").default(false),
  allowedHours: jsonb("allowed_hours"), // Time restrictions
  isActive: boolean("is_active").default(true),
  lastMaintenance: timestamp("last_maintenance"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================================================
// PERSONNEL
// =============================================================================

// Internal staff (hosts)
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  employeeId: text("employee_id").unique(), // Company employee ID
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  department: text("department"),
  jobTitle: text("job_title"),
  manager: text("manager"),
  locationId: uuid("location_id").references(() => locations.id),
  avatar: text("avatar"), // URL to avatar
  bio: text("bio"),
  skills: jsonb("skills"), // Array of skills/specialties
  languages: jsonb("languages"), // Spoken languages
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  isActive: boolean("is_active").default(true),
  canHost: boolean("can_host").default(true),
  canEscort: boolean("can_escort").default(false),
  maxConcurrentVisits: integer("max_concurrent_visits").default(5),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// External individuals
export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(), // Optional for repeat visitors
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  company: text("company"),
  jobTitle: text("job_title"),
  nationality: text("nationality"),
  preferredLanguage: text("preferred_language").default("en"),
  photo: text("photo"), // URL to visitor photo
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  specialNeeds: text("special_needs"), // Accessibility requirements
  dietaryRestrictions: text("dietary_restrictions"),
  notes: text("notes"),
  isBlacklisted: boolean("is_blacklisted").default(false),
  blacklistReason: text("blacklist_reason"),
  blacklistedAt: timestamp("blacklisted_at"),
  lastVisit: timestamp("last_visit"),
  visitCount: integer("visit_count").default(0),
  riskScore: integer("risk_score").default(0), // 0-100 risk assessment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ID documents (encrypted fields)
export const visitorIdentification = pgTable("visitor_identification", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitorId: uuid("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  idType: text("id_type").notNull(), // passport, drivers_license, national_id, etc.
  idNumber: text("id_number").notNull(), // ENCRYPTED
  issuingCountry: text("issuing_country"),
  issuingState: text("issuing_state"),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  documentPhoto: text("document_photo"), // URL to ID document photo
  isVerified: boolean("is_verified").default(false),
  verifiedBy: uuid("verified_by").references(() => employees.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================================================
// VISIT MANAGEMENT
// =============================================================================

// Pre-scheduled visits
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  visitorId: uuid("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  hostId: uuid("host_id")
    .references(() => employees.id)
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id)
    .notNull(),
  visitType: visitTypeEnum("visit_type").notNull().default("meeting"),
  title: text("title").notNull(),
  description: text("description"),
  purpose: text("purpose").notNull(),
  scheduledStartTime: timestamp("scheduled_start_time").notNull(),
  scheduledEndTime: timestamp("scheduled_end_time").notNull(),
  meetingRoom: text("meeting_room"),
  parkingRequired: boolean("parking_required").default(false),
  parkingSpot: text("parking_spot"),
  escortRequired: boolean("escort_required").default(false),
  escortId: uuid("escort_id").references(() => employees.id),
  requiresApproval: boolean("requires_approval").default(false),
  approvalStatus: text("approval_status").default("pending"), // pending, approved, rejected
  approvedBy: uuid("approved_by").references(() => employees.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  specialInstructions: text("special_instructions"),
  equipmentNeeds: jsonb("equipment_needs"), // Array of needed equipment
  notes: text("notes"),
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  isCancelled: boolean("is_cancelled").default(false),
  cancelledBy: uuid("cancelled_by").references(() => employees.id),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdBy: uuid("created_by")
    .references(() => employees.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Actual check-in/out records
export const visits = pgTable("visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id), // null for walk-ins
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  visitorId: uuid("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  hostId: uuid("host_id")
    .references(() => employees.id)
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id)
    .notNull(),
  visitType: visitTypeEnum("visit_type").notNull().default("meeting"),
  status: visitStatusEnum("status").notNull().default("scheduled"),
  purpose: text("purpose").notNull(),
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  duration: integer("duration"), // minutes
  badgeNumber: text("badge_number"),
  badgeReturned: boolean("badge_returned").default(false),
  parkingSpot: text("parking_spot"),
  checkInMethod: text("check_in_method"), // qr_code, manual, kiosk, mobile
  checkInDevice: text("check_in_device"), // Device identifier
  checkOutMethod: text("check_out_method"),
  checkOutDevice: text("check_out_device"),
  temperature: text("temperature"), // Health screening
  healthScreening: jsonb("health_screening"), // COVID/health questions
  signedDocuments: jsonb("signed_documents"), // Array of signed document IDs
  accessPoints: jsonb("access_points"), // Array of access points used
  escortId: uuid("escort_id").references(() => employees.id),
  escortNotes: text("escort_notes"),
  visitorRating: integer("visitor_rating"), // 1-5 experience rating
  visitorFeedback: text("visitor_feedback"),
  hostRating: integer("host_rating"), // Host rates the visit
  hostFeedback: text("host_feedback"),
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Staff-only notes
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  flaggedBy: uuid("flagged_by").references(() => employees.id),
  flaggedAt: timestamp("flagged_at"),
  createdBy: uuid("created_by")
    .references(() => employees.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// State change audit trail
export const visitStatusHistory = pgTable("visit_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .references(() => visits.id)
    .notNull(),
  fromStatus: visitStatusEnum("from_status"),
  toStatus: visitStatusEnum("to_status").notNull(),
  reason: text("reason"),
  notes: text("notes"),
  changedBy: uuid("changed_by")
    .references(() => employees.id)
    .notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceInfo: jsonb("device_info"),
});

// Entry/exit attempts with timestamps
export const accessLogs = pgTable("access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  accessPointId: uuid("access_point_id")
    .references(() => accessPoints.id)
    .notNull(),
  visitorId: uuid("visitor_id").references(() => visitors.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  visitId: uuid("visit_id").references(() => visits.id),
  action: accessLogActionEnum("action").notNull(),
  credentialType: text("credential_type"), // badge, biometric, pin, etc.
  credentialId: text("credential_id"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  direction: text("direction"), // entry, exit
  tailgating: boolean("tailgating").default(false), // Unauthorized following
  forced: boolean("forced").default(false), // Door forced open
  deviceId: text("device_id"), // Physical device identifier
  rawData: jsonb("raw_data"), // Raw sensor/card reader data
  photo: text("photo"), // Security camera snapshot
  temperature: text("temperature"), // If thermal screening
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================================================
// COMPLIANCE & SECURITY
// =============================================================================

// Versioned legal documents (NDA, etc.)
export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // nda, waiver, terms, privacy_policy, etc.
  version: text("version").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(), // HTML content
  isDefault: boolean("is_default").default(false),
  status: documentStatusEnum("status").notNull().default("draft"),
  language: text("language").default("en"),
  requiredForVisitTypes: jsonb("required_for_visit_types"), // Array of visit types
  expiryDays: integer("expiry_days"), // Days until signature expires
  legalReview: boolean("legal_review").default(false),
  reviewedBy: uuid("reviewed_by").references(() => employees.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: uuid("approved_by").references(() => employees.id),
  approvedAt: timestamp("approved_at"),
  archivedAt: timestamp("archived_at"),
  createdBy: uuid("created_by")
    .references(() => employees.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Signed documents per visit
export const visitDocuments = pgTable("visit_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .references(() => visits.id)
    .notNull(),
  documentTemplateId: uuid("document_template_id")
    .references(() => documentTemplates.id)
    .notNull(),
  visitorId: uuid("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  signatureData: text("signature_data"), // Base64 signature image or digital signature
  signatureMethod: text("signature_method"), // digital, electronic, wet_signature
  signedAt: timestamp("signed_at").notNull(),
  ipAddress: text("ip_address"),
  deviceInfo: jsonb("device_info"),
  documentHash: text("document_hash"), // SHA-256 hash for integrity
  witnessId: uuid("witness_id").references(() => employees.id),
  notes: text("notes"),
  isValid: boolean("is_valid").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Captured images (reference to storage)
export const visitorPhotos = pgTable("visitor_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitorId: uuid("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  visitId: uuid("visit_id").references(() => visits.id),
  photoType: text("photo_type").notNull(), // checkin, checkout, profile, id_verification
  filePath: text("file_path").notNull(), // S3 or storage path
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  resolution: text("resolution"), // e.g., "1920x1080"
  capturedAt: timestamp("captured_at").notNull(),
  capturedBy: uuid("captured_by").references(() => employees.id),
  deviceId: text("device_id"), // Camera/device identifier
  isProcessed: boolean("is_processed").default(false),
  processingResults: jsonb("processing_results"), // Face recognition, etc.
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  retentionUntil: timestamp("retention_until"), // GDPR compliance
  createdAt: timestamp("created_at").defaultNow(),
});

// Flagged events
export const securityIncidents = pgTable("security_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  visitId: uuid("visit_id").references(() => visits.id),
  visitorId: uuid("visitor_id").references(() => visitors.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  accessPointId: uuid("access_point_id").references(() => accessPoints.id),
  incidentType: text("incident_type").notNull(), // unauthorized_access, tailgating, etc.
  severity: incidentSeverityEnum("severity").notNull().default("low"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("open"), // open, investigating, resolved, closed
  automaticDetection: boolean("automatic_detection").default(false),
  reportedBy: uuid("reported_by").references(() => employees.id),
  assignedTo: uuid("assigned_to").references(() => employees.id),
  resolvedBy: uuid("resolved_by").references(() => employees.id),
  resolutionNotes: text("resolution_notes"),
  evidencePhotos: jsonb("evidence_photos"), // Array of photo URLs
  witnessStatements: jsonb("witness_statements"),
  actionsTaken: text("actions_taken"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  reportedAt: timestamp("reported_at").defaultNow(),
  occurredAt: timestamp("occurred_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Restricted individuals
export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  visitorId: uuid("visitor_id").references(() => visitors.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  photo: text("photo"),
  identifiers: jsonb("identifiers"), // ID numbers, biometric data, etc.
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  category: text("category").notNull(), // security_threat, banned_visitor, etc.
  reason: text("reason").notNull(),
  description: text("description"),
  source: text("source"), // internal, law_enforcement, third_party
  alertOnMatch: boolean("alert_on_match").default(true),
  autoReject: boolean("auto_reject").default(false),
  allowOverride: boolean("allow_override").default(true),
  addedBy: uuid("added_by")
    .references(() => employees.id)
    .notNull(),
  reviewedBy: uuid("reviewed_by").references(() => employees.id),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  lastMatchedAt: timestamp("last_matched_at"),
  matchCount: integer("match_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================================================
// AUTHENTICATION & AUTHORIZATION
// =============================================================================

// Login credentials (employees only)
export const systemUsers = pgTable("system_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .references(() => employees.id)
    .notNull()
    .unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  saltHash: text("salt_hash").notNull(),
  isActive: boolean("is_active").default(true),
  isLocked: boolean("is_locked").default(false),
  lockReason: text("lock_reason"),
  lockedAt: timestamp("locked_at"),
  lockedUntil: timestamp("locked_until"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLoginAt: timestamp("last_failed_login_at"),
  lastSuccessfulLoginAt: timestamp("last_successful_login_at"),
  lastPasswordChangeAt: timestamp("last_password_change_at").defaultNow(),
  passwordExpiresAt: timestamp("password_expires_at"),
  mustChangePassword: boolean("must_change_password").default(false),
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: text("mfa_secret"), // TOTP secret
  mfaBackupCodes: jsonb("mfa_backup_codes"), // Encrypted backup codes
  preferredLanguage: text("preferred_language").default("en"),
  timezone: text("timezone").default("UTC"),
  lastActivityAt: timestamp("last_activity_at"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Permission groups (Admin, Host, Security, etc.)
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false), // Built-in vs custom
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Higher priority overrides lower
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Granular actions
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  resource: text("resource").notNull(), // visitors, visits, employees, etc.
  action: text("action").notNull(), // create, read, update, delete, approve, etc.
  description: text("description"),
  isSystemPermission: boolean("is_system_permission").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Many-to-many mapping
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => systemUsers.id)
    .notNull(),
  roleId: uuid("role_id")
    .references(() => roles.id)
    .notNull(),
  assignedBy: uuid("assigned_by")
    .references(() => employees.id)
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

// Role capabilities
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id")
    .references(() => roles.id)
    .notNull(),
  permissionId: uuid("permission_id")
    .references(() => permissions.id)
    .notNull(),
  granted: boolean("granted").default(true),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sessions, MFA, password resets
export const authenticationTokens = pgTable("authentication_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => systemUsers.id)
    .notNull(),
  tokenType: tokenTypeEnum("token_type").notNull(),
  tokenHash: text("token_hash").notNull(), // Hashed token
  tokenHint: text("token_hint"), // Last 4 chars for identification
  isActive: boolean("is_active").default(true),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  geoLocation: jsonb("geo_location"), // Country, city, etc.
  metadata: jsonb("metadata"), // Additional token-specific data
  revokedAt: timestamp("revoked_at"),
  revokedBy: uuid("revoked_by").references(() => employees.id),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// System action history
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id").references(() => systemUsers.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  visitorId: uuid("visitor_id").references(() => visitors.id),
  visitId: uuid("visit_id").references(() => visits.id),
  action: auditActionEnum("action").notNull(),
  resource: text("resource").notNull(), // Table/entity name
  resourceId: text("resource_id"), // ID of affected record
  description: text("description"),
  oldValues: jsonb("old_values"), // Previous data
  newValues: jsonb("new_values"), // New/updated data
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceId: text("device_id"),
  sessionId: text("session_id"),
  requestId: text("request_id"), // For request tracing
  duration: integer("duration"), // Operation duration in ms
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  severity: text("severity").default("info"), // info, warning, error, critical
  tags: jsonb("tags"), // Array of searchable tags
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow(),
});
