import { AdminNav } from "@/components/admin-nav"
import { AdminActionForm, AdminDeleteForm, SubmitButton } from "@/components/admin-ui"
import { PermissionDenied } from "@/components/permission-denied"
import { createStaffUser, deactivateAdminUser } from "@/lib/admin-user-actions"
import { requirePermission } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const roleLabels = {
  ADMIN: "Admin",
  ORDER_STAFF: "Order staff",
  INVENTORY_STAFF: "Inventory staff"
} as const

function roleLabel(role: string) {
  return role in roleLabels ? roleLabels[role as keyof typeof roleLabels] : "Admin user"
}

export default async function AdminUsersPage() {
  let currentUser: Awaited<ReturnType<typeof requirePermission>>
  try {
    currentUser = await requirePermission("admin-users:manage")
  } catch {
    return <PermissionDenied />
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "ORDER_STAFF", "INVENTORY_STAFF"] } },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      createdAt: true,
      email: true,
      id: true,
      isActive: true,
      name: true,
      role: true
    }
  })

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Admin users</h1>
        <p>Manage owner and staff access for grocery operations.</p>
        <AdminNav active="users" />
      </div>

      <div className="admin-shell">
        <section className="panel admin-sticky">
          <AdminActionForm action={createStaffUser}>
            <h2 style={{ margin: 0 }}>Create staff user</h2>
            <p className="muted" style={{ margin: 0 }}>
              Staff accounts get limited access based on their role.
            </p>
            <label className="form-field">
              <span>Name</span>
              <input className="field" name="name" placeholder="Staff name" required />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input className="field" name="email" placeholder="staff@example.com" required type="email" />
            </label>
            <label className="form-field">
              <span>Temporary password</span>
              <input className="field" minLength={8} name="password" placeholder="At least 8 characters" required type="password" />
            </label>
            <label className="form-field">
              <span>Role</span>
              <select className="select" name="role" required>
                <option value="ORDER_STAFF">Order staff</option>
                <option value="INVENTORY_STAFF">Inventory staff</option>
              </select>
            </label>
            <SubmitButton pendingLabel="Creating...">Create staff user</SubmitButton>
          </AdminActionForm>
        </section>

        <section className="admin-list">
          {users.map((user) => {
            const canDeactivate = user.isActive && user.id !== currentUser.id
            return (
              <article className={`admin-card ${user.isActive ? "" : "muted-card"}`} key={user.id}>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div>
                      <p className="muted">{roleLabel(user.role)}</p>
                      <h2>{user.name}</h2>
                    </div>
                    <span className={`status-badge ${user.isActive ? "status-confirmed" : "status-cancelled"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="admin-user-meta">
                    <span>{user.email}</span>
                    <span>Created {user.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  {canDeactivate ? (
                    <AdminDeleteForm
                      action={deactivateAdminUser.bind(null, user.id)}
                      confirmMessage={`Deactivate ${user.name}? They will no longer be able to log in.`}
                      label="Deactivate"
                    />
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
