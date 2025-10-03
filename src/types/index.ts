// Database entity types
export interface User {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role:
    | "super_admin"
    | "company_admin"
    | "security"
    | "employee"
    | "receptionist";
  department?: string;
  jobTitle?: string;
  locationId?: string;
  areaId?: string;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visitor {
  id: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone: string;
  company?: string;
  idType?: string;
  idNumber?: string;
  photo?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visit {
  id: string;
  companyId: string;
  visitorId: string;
  hostId: string;
  locationId: string;
  areaId?: string;
  visitType:
    | "meeting"
    | "delivery"
    | "interview"
    | "maintenance"
    | "visitor"
    | "contractor"
    | "other";
  status:
    | "scheduled"
    | "checked_in"
    | "in_progress"
    | "checked_out"
    | "no_show"
    | "cancelled";
  purpose: string;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  badgeNumber?: string;
  parkingSpot?: string;
  escortRequired: boolean;
  escortId?: string;
  checkInMethod?: string;
  deviceInfo?: any;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  address?: string;
  phone?: string;
  website?: string;
  logo?: string;
  settings?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
  address: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Area {
  id: string;
  locationId: string;
  name: string;
  description?: string;
  capacity?: number;
  requiresEscort: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Authentication types
export interface JwtPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends User {
  token: string;
  refreshToken?: string;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Audit types
export interface AuditLog {
  id: string;
  companyId: string;
  userId?: string;
  visitorId?: string;
  visitId?: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "login"
    | "logout"
    | "check_in"
    | "check_out";
  tableName?: string;
  recordId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  createdAt: Date;
}

// Visit related types
export interface VisitWithDetails extends Omit<Visit, "createdBy"> {
  visitor: Visitor;
  host: User;
  location: Location;
  area?: Area;
  escort?: User;
  createdBy: User;
}

export interface VisitApproval {
  id: string;
  visitId: string;
  approverId: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export interface VisitLog {
  id: string;
  visitId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  performedBy?: string;
  locationId?: string;
  deviceInfo?: any;
  notes?: string;
  createdAt: Date;
}

// Error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Utility types
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

// Database query types
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
}

export interface DatabaseResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
