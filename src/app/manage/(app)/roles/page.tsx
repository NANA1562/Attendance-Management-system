import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, jobRoles } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, Field, Input, Pill } from "@/components/ui";
import { requireManager } from "@/server/auth";
import { createRole, toggleRole } from "../../actions";

export default async function RolesPage() {
  const { business } = await requireManager();
  const [roles, staff] = await Promise.all([
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
    db.select({ roleId: employees.roleId }).from(employees).where(eq(employees.businessId, business.id)),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Job roles">
        <p className="mb-4 text-sm text-stone-600">
          A role is what someone does (Cashier, Store Assistant). It's separate from their level, which controls dashboard access.
          Tasks can be assigned to a role so everyone in it gets them.
        </p>
        {roles.length === 0 ? (
          <p className="text-sm text-stone-500">No roles yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {roles.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {r.name} {r.status === "inactive" && <Pill>Disabled</Pill>}
                  </div>
                  <div className="text-xs text-stone-500">
                    {staff.filter((s) => s.roleId === r.id).length} staff{r.description && ` · ${r.description}`}
                  </div>
                </div>
                <form action={toggleRole}>
                  <input type="hidden" name="roleId" value={r.id} />
                  <input type="hidden" name="status" value={r.status === "active" ? "inactive" : "active"} />
                  <Button variant="secondary" className="px-3 py-1 text-xs">{r.status === "active" ? "Disable" : "Enable"}</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="New role">
        <ActionForm action={createRole} className="space-y-4" resetOnSuccess>
          <Field label="Name"><Input name="name" placeholder="e.g. Cashier" required /></Field>
          <Field label="Description (optional)"><Input name="description" /></Field>
          <SubmitButton className="w-full">Create role</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
