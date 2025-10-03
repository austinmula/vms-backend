import { relations } from "drizzle-orm";
import {
  // Organizations & Locations
  organizations,
  locations,
  accessPoints,
  // Personnel
  employees,
  visitors,
  visitorIdentification,
  // Visit Management
  appointments,
  visits,
  visitStatusHistory,
  accessLogs,
  // Compliance & Security
  documentTemplates,
  visitDocuments,
  visitorPhotos,
  securityIncidents,
  watchlist,
  // Authentication & Authorization
  systemUsers,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  authenticationTokens,
  auditLogs,
} from "./tables";

// =============================================================================
// ORGANIZATIONS & LOCATIONS RELATIONS
// =============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  employees: many(employees),
  appointments: many(appointments),
  visits: many(visits),
  documentTemplates: many(documentTemplates),
  securityIncidents: many(securityIncidents),
  watchlist: many(watchlist),
  roles: many(roles),
  auditLogs: many(auditLogs),
  accessLogs: many(accessLogs),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.organizationId],
    references: [organizations.id],
  }),
  accessPoints: many(accessPoints),
  employees: many(employees),
  appointments: many(appointments),
  visits: many(visits),
  securityIncidents: many(securityIncidents),
  visitStatusHistory: many(visitStatusHistory),
}));

export const accessPointsRelations = relations(
  accessPoints,
  ({ one, many }) => ({
    location: one(locations, {
      fields: [accessPoints.locationId],
      references: [locations.id],
    }),
    accessLogs: many(accessLogs),
    securityIncidents: many(securityIncidents),
  })
);

// =============================================================================
// PERSONNEL RELATIONS
// =============================================================================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [employees.organizationId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [employees.locationId],
    references: [locations.id],
  }),
  systemUser: one(systemUsers),
  hostedAppointments: many(appointments, { relationName: "hostAppointments" }),
  escortedAppointments: many(appointments, {
    relationName: "escortAppointments",
  }),
  createdAppointments: many(appointments, {
    relationName: "createdAppointments",
  }),
  approvedAppointments: many(appointments, {
    relationName: "approvedAppointments",
  }),
  cancelledAppointments: many(appointments, {
    relationName: "cancelledAppointments",
  }),
  hostedVisits: many(visits, { relationName: "hostVisits" }),
  escortedVisits: many(visits, { relationName: "escortVisits" }),
  createdVisits: many(visits, { relationName: "createdVisits" }),
  flaggedVisits: many(visits, { relationName: "flaggedVisits" }),
  verifiedIdentifications: many(visitorIdentification),
  createdDocumentTemplates: many(documentTemplates, {
    relationName: "createdDocumentTemplates",
  }),
  reviewedDocumentTemplates: many(documentTemplates, {
    relationName: "reviewedDocumentTemplates",
  }),
  approvedDocumentTemplates: many(documentTemplates, {
    relationName: "approvedDocumentTemplates",
  }),
  witnessedDocuments: many(visitDocuments),
  capturedPhotos: many(visitorPhotos),
  reportedIncidents: many(securityIncidents, {
    relationName: "reportedIncidents",
  }),
  assignedIncidents: many(securityIncidents, {
    relationName: "assignedIncidents",
  }),
  resolvedIncidents: many(securityIncidents, {
    relationName: "resolvedIncidents",
  }),
  addedWatchlist: many(watchlist, { relationName: "addedWatchlist" }),
  reviewedWatchlist: many(watchlist, { relationName: "reviewedWatchlist" }),
  accessLogs: many(accessLogs),
  visitStatusChanges: many(visitStatusHistory),
  createdUsers: many(systemUsers, { relationName: "createdUsers" }),
  assignedRoles: many(userRoles, { relationName: "assignedRoles" }),
  createdRoles: many(roles),
  createdRolePermissions: many(rolePermissions),
  revokedTokens: many(authenticationTokens),
  auditLogs: many(auditLogs),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  identifications: many(visitorIdentification),
  appointments: many(appointments),
  visits: many(visits),
  documents: many(visitDocuments),
  photos: many(visitorPhotos),
  securityIncidents: many(securityIncidents),
  watchlistEntries: many(watchlist),
  accessLogs: many(accessLogs),
  auditLogs: many(auditLogs),
}));

export const visitorIdentificationRelations = relations(
  visitorIdentification,
  ({ one }) => ({
    visitor: one(visitors, {
      fields: [visitorIdentification.visitorId],
      references: [visitors.id],
    }),
    verifiedBy: one(employees, {
      fields: [visitorIdentification.verifiedBy],
      references: [employees.id],
    }),
  })
);

// =============================================================================
// VISIT MANAGEMENT RELATIONS
// =============================================================================

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [appointments.organizationId],
      references: [organizations.id],
    }),
    visitor: one(visitors, {
      fields: [appointments.visitorId],
      references: [visitors.id],
    }),
    host: one(employees, {
      fields: [appointments.hostId],
      references: [employees.id],
      relationName: "hostAppointments",
    }),
    location: one(locations, {
      fields: [appointments.locationId],
      references: [locations.id],
    }),
    escort: one(employees, {
      fields: [appointments.escortId],
      references: [employees.id],
      relationName: "escortAppointments",
    }),
    approvedBy: one(employees, {
      fields: [appointments.approvedBy],
      references: [employees.id],
      relationName: "approvedAppointments",
    }),
    cancelledBy: one(employees, {
      fields: [appointments.cancelledBy],
      references: [employees.id],
      relationName: "cancelledAppointments",
    }),
    createdBy: one(employees, {
      fields: [appointments.createdBy],
      references: [employees.id],
      relationName: "createdAppointments",
    }),
    visits: many(visits),
  })
);

export const visitsRelations = relations(visits, ({ one, many }) => ({
  appointment: one(appointments, {
    fields: [visits.appointmentId],
    references: [appointments.id],
  }),
  organization: one(organizations, {
    fields: [visits.organizationId],
    references: [organizations.id],
  }),
  visitor: one(visitors, {
    fields: [visits.visitorId],
    references: [visitors.id],
  }),
  host: one(employees, {
    fields: [visits.hostId],
    references: [employees.id],
    relationName: "hostVisits",
  }),
  location: one(locations, {
    fields: [visits.locationId],
    references: [locations.id],
  }),
  escort: one(employees, {
    fields: [visits.escortId],
    references: [employees.id],
    relationName: "escortVisits",
  }),
  flaggedBy: one(employees, {
    fields: [visits.flaggedBy],
    references: [employees.id],
    relationName: "flaggedVisits",
  }),
  createdBy: one(employees, {
    fields: [visits.createdBy],
    references: [employees.id],
    relationName: "createdVisits",
  }),
  statusHistory: many(visitStatusHistory),
  documents: many(visitDocuments),
  photos: many(visitorPhotos),
  securityIncidents: many(securityIncidents),
  accessLogs: many(accessLogs),
  auditLogs: many(auditLogs),
}));

export const visitStatusHistoryRelations = relations(
  visitStatusHistory,
  ({ one }) => ({
    visit: one(visits, {
      fields: [visitStatusHistory.visitId],
      references: [visits.id],
    }),
    changedBy: one(employees, {
      fields: [visitStatusHistory.changedBy],
      references: [employees.id],
    }),
  })
);

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [accessLogs.organizationId],
    references: [organizations.id],
  }),
  accessPoint: one(accessPoints, {
    fields: [accessLogs.accessPointId],
    references: [accessPoints.id],
  }),
  visitor: one(visitors, {
    fields: [accessLogs.visitorId],
    references: [visitors.id],
  }),
  employee: one(employees, {
    fields: [accessLogs.employeeId],
    references: [employees.id],
  }),
  visit: one(visits, {
    fields: [accessLogs.visitId],
    references: [visits.id],
  }),
}));

// =============================================================================
// COMPLIANCE & SECURITY RELATIONS
// =============================================================================

export const documentTemplatesRelations = relations(
  documentTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [documentTemplates.organizationId],
      references: [organizations.id],
    }),
    createdBy: one(employees, {
      fields: [documentTemplates.createdBy],
      references: [employees.id],
      relationName: "createdDocumentTemplates",
    }),
    reviewedBy: one(employees, {
      fields: [documentTemplates.reviewedBy],
      references: [employees.id],
      relationName: "reviewedDocumentTemplates",
    }),
    approvedBy: one(employees, {
      fields: [documentTemplates.approvedBy],
      references: [employees.id],
      relationName: "approvedDocumentTemplates",
    }),
    visitDocuments: many(visitDocuments),
  })
);

export const visitDocumentsRelations = relations(visitDocuments, ({ one }) => ({
  visit: one(visits, {
    fields: [visitDocuments.visitId],
    references: [visits.id],
  }),
  documentTemplate: one(documentTemplates, {
    fields: [visitDocuments.documentTemplateId],
    references: [documentTemplates.id],
  }),
  visitor: one(visitors, {
    fields: [visitDocuments.visitorId],
    references: [visitors.id],
  }),
  witness: one(employees, {
    fields: [visitDocuments.witnessId],
    references: [employees.id],
  }),
}));

export const visitorPhotosRelations = relations(visitorPhotos, ({ one }) => ({
  visitor: one(visitors, {
    fields: [visitorPhotos.visitorId],
    references: [visitors.id],
  }),
  visit: one(visits, {
    fields: [visitorPhotos.visitId],
    references: [visits.id],
  }),
  capturedBy: one(employees, {
    fields: [visitorPhotos.capturedBy],
    references: [employees.id],
  }),
}));

export const securityIncidentsRelations = relations(
  securityIncidents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [securityIncidents.organizationId],
      references: [organizations.id],
    }),
    location: one(locations, {
      fields: [securityIncidents.locationId],
      references: [locations.id],
    }),
    visit: one(visits, {
      fields: [securityIncidents.visitId],
      references: [visits.id],
    }),
    visitor: one(visitors, {
      fields: [securityIncidents.visitorId],
      references: [visitors.id],
    }),
    employee: one(employees, {
      fields: [securityIncidents.employeeId],
      references: [employees.id],
    }),
    accessPoint: one(accessPoints, {
      fields: [securityIncidents.accessPointId],
      references: [accessPoints.id],
    }),
    reportedBy: one(employees, {
      fields: [securityIncidents.reportedBy],
      references: [employees.id],
      relationName: "reportedIncidents",
    }),
    assignedTo: one(employees, {
      fields: [securityIncidents.assignedTo],
      references: [employees.id],
      relationName: "assignedIncidents",
    }),
    resolvedBy: one(employees, {
      fields: [securityIncidents.resolvedBy],
      references: [employees.id],
      relationName: "resolvedIncidents",
    }),
  })
);

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  organization: one(organizations, {
    fields: [watchlist.organizationId],
    references: [organizations.id],
  }),
  visitor: one(visitors, {
    fields: [watchlist.visitorId],
    references: [visitors.id],
  }),
  addedBy: one(employees, {
    fields: [watchlist.addedBy],
    references: [employees.id],
    relationName: "addedWatchlist",
  }),
  reviewedBy: one(employees, {
    fields: [watchlist.reviewedBy],
    references: [employees.id],
    relationName: "reviewedWatchlist",
  }),
}));

// =============================================================================
// AUTHENTICATION & AUTHORIZATION RELATIONS
// =============================================================================

export const systemUsersRelations = relations(systemUsers, ({ one, many }) => ({
  employee: one(employees, {
    fields: [systemUsers.employeeId],
    references: [employees.id],
  }),
  createdBy: one(employees, {
    fields: [systemUsers.createdBy],
    references: [employees.id],
    relationName: "createdUsers",
  }),
  userRoles: many(userRoles),
  authenticationTokens: many(authenticationTokens),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(employees, {
    fields: [roles.createdBy],
    references: [employees.id],
  }),
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(systemUsers, {
    fields: [userRoles.userId],
    references: [systemUsers.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedBy: one(employees, {
    fields: [userRoles.assignedBy],
    references: [employees.id],
    relationName: "assignedRoles",
  }),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
    createdBy: one(employees, {
      fields: [rolePermissions.createdBy],
      references: [employees.id],
    }),
  })
);

export const authenticationTokensRelations = relations(
  authenticationTokens,
  ({ one }) => ({
    user: one(systemUsers, {
      fields: [authenticationTokens.userId],
      references: [systemUsers.id],
    }),
    revokedBy: one(employees, {
      fields: [authenticationTokens.revokedBy],
      references: [employees.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(systemUsers, {
    fields: [auditLogs.userId],
    references: [systemUsers.id],
  }),
  employee: one(employees, {
    fields: [auditLogs.employeeId],
    references: [employees.id],
  }),
  visitor: one(visitors, {
    fields: [auditLogs.visitorId],
    references: [visitors.id],
  }),
  visit: one(visits, {
    fields: [auditLogs.visitId],
    references: [visits.id],
  }),
}));
