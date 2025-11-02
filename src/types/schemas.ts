import { z } from "zod";

// User schemas
export const createUserSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
  roleIds: z.array(z.string().uuid()).optional().default([]),
  mfaEnabled: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/)
    .optional(),
  mfaEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// Visitor schemas
export const createVisitorSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  company: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateVisitorSchema = createVisitorSchema.partial();

// Visit schemas
export const createVisitSchema = z.object({
  visitorId: z.string().uuid(),
  hostId: z.string().uuid(),
  locationId: z.string().uuid(),
  areaId: z.string().uuid().optional(),
  visitType: z
    .enum([
      "meeting",
      "delivery",
      "interview",
      "maintenance",
      "visitor",
      "contractor",
      "other",
    ])
    .default("visitor"),
  purpose: z.string().min(1),
  scheduledStartTime: z.string().datetime(),
  scheduledEndTime: z.string().datetime(),
  escortRequired: z.boolean().default(false),
  escortId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateVisitSchema = createVisitSchema.partial();

export const updateVisitStatusSchema = z.object({
  status: z.enum([
    "scheduled",
    "checked_in",
    "in_progress",
    "checked_out",
    "no_show",
    "cancelled",
  ]),
  notes: z.string().optional(),
});

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  logo: z.string().url().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// Location schemas
export const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  description: z.string().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

// Area schemas
export const createAreaSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().positive().optional(),
  requiresEscort: z.boolean().default(false),
});

export const updateAreaSchema = createAreaSchema
  .partial()
  .omit({ locationId: true });

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const visitFilterSchema = z
  .object({
    status: z
      .enum([
        "scheduled",
        "checked_in",
        "in_progress",
        "checked_out",
        "no_show",
        "cancelled",
      ])
      .optional(),
    visitType: z
      .enum([
        "meeting",
        "delivery",
        "interview",
        "maintenance",
        "visitor",
        "contractor",
        "other",
      ])
      .optional(),
    hostId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .merge(paginationSchema);

export const userFilterSchema = z
  .object({
    role: z
      .enum([
        "super_admin",
        "company_admin",
        "security",
        "employee",
        "receptionist",
      ])
      .optional(),
    locationId: z.string().uuid().optional(),
    areaId: z.string().uuid().optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .merge(paginationSchema);

// Role assignment schema
export const assignRolesSchema = z.object({
  roleIds: z
    .array(z.string().uuid())
    .min(1, "At least one role ID is required"),
});

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined))
    .optional()
    .or(z.boolean().optional()),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// Visitor query/filter schemas
export const listVisitorsQuerySchema = z.object({
  search: z.string().optional(), // Search by name, email, company, phone
  isBlacklisted: z
    .string()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined))
    .optional()
    .or(z.boolean().optional()),
  company: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  offset: z.coerce.number().min(0).optional().default(0),
});

// Response schemas
export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
});

export const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.array(z.string()).optional(),
});

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  domain: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal("")),
  subscriptionTier: z.enum(["free", "basic", "premium", "enterprise"]).default("basic"),
  timezone: z.string().default("UTC"),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const organizationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  subscriptionTier: z.enum(["free", "basic", "premium", "enterprise"]).optional(),
  isActive: z.coerce.boolean().optional(),
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;
export type UpdateVisitorInput = z.infer<typeof updateVisitorSchema>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type UpdateVisitStatusInput = z.infer<typeof updateVisitStatusSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type VisitFilterInput = z.infer<typeof visitFilterSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type ListVisitorsQueryInput = z.infer<typeof listVisitorsQuerySchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type OrganizationQueryInput = z.infer<typeof organizationQuerySchema>;
