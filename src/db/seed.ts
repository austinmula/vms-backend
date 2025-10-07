import { db } from "./index";
import {
  organizations,
  roles,
  permissions,
  rolePermissions,
  systemUsers,
  userRoles,
  employees,
} from "./schema/tables";
import { AuthUtils } from "../utils";
import logger from "../utils/logger";
import { eq } from "drizzle-orm";

async function runSeed() {
  try {
    console.log("🌱 Starting database seeding...\n");

    // 1. Seed Organizations
    console.log("📢 Creating system organization...");
    const orgInsert = await db
      .insert(organizations)
      .values({
        name: "VMS System Administration",
        slug: "vms-system-admin",
        domain: "system.admin",
        address: "123 System Admin Blvd, Tech City, TC 12345",
        phone: "+1-555-0100",
        timezone: "UTC",
        isActive: true,
        isVerified: true,
        settings: {
          maxConcurrentVisitors: 1000,
          defaultVisitDuration: 480,
          requireApproval: false,
          enableWatchlist: true,
          retentionDays: 2555,
        },
      })
      .returning()
      .onConflictDoNothing();

    let orgId = null;
    if (orgInsert.length > 0) {
      orgId = orgInsert[0]?.id;
      console.log("✅ Organization created");
    } else {
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, "vms-system-admin"))
        .limit(1);
      orgId = existing[0]?.id;
      console.log("ℹ️  Organization already exists");
    }

    if (!orgId) {
      throw new Error("Could not create or find organization");
    }

    // 2. Create System Employee (needed for systemUsers)
    console.log("👤 Creating system employee...");
    const employeeInsert = await db
      .insert(employees)
      .values({
        organizationId: orgId,
        email: "admin@vms.system",
        employeeId: "ADMIN001",
        firstName: "System",
        lastName: "Administrator",
        phone: "+1-555-0001",
        department: "IT",
        jobTitle: "System Administrator",
        isActive: true,
      })
      .returning()
      .onConflictDoNothing();

    let employeeId = null;
    if (employeeInsert.length > 0) {
      employeeId = employeeInsert[0]?.id;
      console.log("✅ System employee created");
    } else {
      const existing = await db
        .select()
        .from(employees)
        .where(eq(employees.email, "admin@vms.system"))
        .limit(1);
      employeeId = existing[0]?.id;
      console.log("ℹ️  System employee already exists");
    }

    // 3. Seed System Permissions
    console.log("🔐 Creating system permissions...");
    const systemPermissions = [
      {
        name: "system.admin",
        slug: "system-admin",
        resource: "system",
        action: "admin",
        description: "Full system administration access",
      },
      {
        name: "organizations.manage",
        slug: "organizations-manage",
        resource: "organizations",
        action: "manage",
        description: "Manage organizations",
      },
      {
        name: "users.manage",
        slug: "users-manage",
        resource: "users",
        action: "manage",
        description: "Manage users",
      },
      {
        name: "visitors.manage",
        slug: "visitors-manage",
        resource: "visitors",
        action: "manage",
        description: "Manage visitors",
      },
      {
        name: "visits.manage",
        slug: "visits-manage",
        resource: "visits",
        action: "manage",
        description: "Manage visits",
      },
      {
        name: "visits.checkin",
        slug: "visits-checkin",
        resource: "visits",
        action: "checkin",
        description: "Check visitors in/out",
      },
    ];

    const createdPermissions = [];
    for (const perm of systemPermissions) {
      const permInsert = await db
        .insert(permissions)
        .values(perm)
        .returning()
        .onConflictDoNothing();
      if (permInsert.length > 0) {
        createdPermissions.push(permInsert[0]);
      } else {
        const existing = await db
          .select()
          .from(permissions)
          .where(eq(permissions.name, perm.name))
          .limit(1);
        if (existing.length > 0) createdPermissions.push(existing[0]);
      }
    }
    console.log(`✅ ${createdPermissions.length} permissions ready`);

    // 4. Seed System Roles
    console.log("👨‍💼 Creating system roles...");

    // Super Admin Role
    const superAdminRoleInsert = await db
      .insert(roles)
      .values({
        name: "super_admin",
        slug: "super-admin",
        description: "Full system access across all organizations",
        organizationId: orgId,
        isSystemRole: true,
        priority: 100,
      })
      .returning()
      .onConflictDoNothing();

    let superAdminRoleId = null;
    if (superAdminRoleInsert.length > 0) {
      superAdminRoleId = superAdminRoleInsert[0]?.id;
    } else {
      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.name, "super_admin"))
        .limit(1);
      superAdminRoleId = existing[0]?.id;
    }

    // Receptionist Role
    const receptionistRoleInsert = await db
      .insert(roles)
      .values({
        name: "receptionist",
        slug: "receptionist",
        description: "Visitor check-in/out and basic management",
        organizationId: orgId,
        isSystemRole: true,
        priority: 70,
      })
      .returning()
      .onConflictDoNothing();

    let receptionistRoleId = null;
    if (receptionistRoleInsert.length > 0) {
      receptionistRoleId = receptionistRoleInsert[0]?.id;
    } else {
      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.name, "receptionist"))
        .limit(1);
      receptionistRoleId = existing[0]?.id;
    }

    console.log("✅ Roles created (Super Admin & Receptionist)");

    // 5. Assign permissions to roles
    console.log("🔗 Linking permissions to roles...");

    if (superAdminRoleId) {
      for (const permission of createdPermissions) {
        if (permission) {
          await db
            .insert(rolePermissions)
            .values({
              roleId: superAdminRoleId,
              permissionId: permission.id,
            })
            .onConflictDoNothing();
        }
      }
    }

    if (receptionistRoleId) {
      const checkInPermission = createdPermissions.find(
        (p) => p && p.name === "visits.checkin"
      );
      const visitorsManagePermission = createdPermissions.find(
        (p) => p && p.name === "visitors.manage"
      );

      if (checkInPermission) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: receptionistRoleId,
            permissionId: checkInPermission.id,
          })
          .onConflictDoNothing();
      }

      if (visitorsManagePermission) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: receptionistRoleId,
            permissionId: visitorsManagePermission.id,
          })
          .onConflictDoNothing();
      }
    }

    console.log("✅ Permission assignments complete");

    // 6. Seed Super Admin User
    console.log("🔐 Creating super admin system user...");

    if (!employeeId) {
      throw new Error("Could not create or find employee");
    }

    const hashedPassword = await AuthUtils.hashPassword("Admin123!@#");

    const superAdminUserInsert = await db
      .insert(systemUsers)
      .values({
        employeeId: employeeId,
        email: "admin@vms.system",
        passwordHash: hashedPassword,
        saltHash: "system-generated-salt", // This should be generated properly in production
        isActive: true,
        mfaEnabled: false,
      })
      .returning()
      .onConflictDoNothing();

    let superAdminUserId = null;
    if (superAdminUserInsert.length > 0) {
      superAdminUserId = superAdminUserInsert[0]?.id;
    } else {
      const existing = await db
        .select()
        .from(systemUsers)
        .where(eq(systemUsers.email, "admin@vms.system"))
        .limit(1);
      superAdminUserId = existing[0]?.id;
    }

    console.log("✅ Super admin user ready");

    // 7. Assign Super Admin Role
    console.log("🎭 Assigning super admin role...");
    if (superAdminUserId && superAdminRoleId) {
      await db
        .insert(userRoles)
        .values({
          userId: superAdminUserId,
          roleId: superAdminRoleId,
          assignedBy: employeeId,
          isActive: true,
        })
        .onConflictDoNothing();
    }

    console.log("✅ Role assignment complete\n");

    // Final Summary
    console.log("🎉 DATABASE SEEDING COMPLETED!\n");
    console.log("📊 Summary:");
    console.log("   - Organizations: 1");
    console.log("   - Employees: 1");
    console.log("   - Roles: 2 (Super Admin, Receptionist)");
    console.log(`   - Permissions: ${systemPermissions.length}`);
    console.log("   - Users: 1 (Super Admin)\n");

    console.log("🔑 SUPER ADMIN CREDENTIALS:");
    console.log("   Email: admin@vms.system");
    console.log("   Employee ID: ADMIN001");
    console.log("   Password: Admin123!@#\n");

    console.log("🚀 Ready to start building your VMS API!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    logger.error("Database seeding failed:", error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  runSeed()
    .then(() => {
      console.log("Seeding process completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { runSeed };
