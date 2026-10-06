import { asc, eq } from "drizzle-orm";
import { Tags } from "lucide-react";
import { db } from "@/db";
import { employees, jobRoles, taskTemplates } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormButton } from "@/components/form-button";
import { Avatar, Card, cx, Empty, Field, Input, PageHeader, Pill } from "@/components/ui";
import { requireManager } from "@/server/auth";
import { createRole, toggleRole } from "../../actions";

export default async function RolesPage() {
  const { business } = await requireManager();
  const [roles, staff, templates] = await Promise.all([
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
    db.select({ roleId: employees.roleId, fullName: employees.fullName, status: employees.status }).from(employees).where(eq(employees.businessId, business.id)),
    db.select({ roleId: taskTemplates.roleId, status: taskTemplates.status }).from(taskTemplates).where(eq(taskTemplates.businessId, business.id)),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Roles"
        description="A role is what someone does, like Cashier or Store Assistant. It's separate from their level, which controls dashboard access. Tasks assigned to a role go to everyone in it."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        {roles.length === 0 ? (
          <Card><Empty icon={Tags} title="No roles yet">Create your first role on the right.</Empty></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.map((r) => {
              const people = staff.filter((s) => s.roleId === r.id && s.status === "active");
              const tasks = templates.filter((t) => t.roleId === r.id && t.status === "active").length;
              return (
                <section key={r.id} className={cx("flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card", r.status === "inactive" && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Tags className="h-5 w-5" /></span>
                    <form action={toggleRole}>
                      <input type="hidden" name="roleId" value={r.id} />
                      <input type="hidden" name="status" value={r.status === "active" ? "inactive" : "active"} />
                      <FormButton variant="ghost" className="px-3 py-1.5 text-xs">{r.status === "active" ? "Disable" : "Enable"}</FormButton>
                    </form>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold">{r.name}</h3>
                  {r.description && <p className="mt-0.5 text-sm text-ink-2">{r.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <div className="flex -space-x-2">
                      {people.slice(0, 5).map((p) => <Avatar key={p.fullName} name={p.fullName} size="sm" className="ring-2 ring-surface" />)}
                      {people.length === 0 && <span className="text-xs text-muted">No one yet</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <Pill>{people.length} staff</Pill>
                      <Pill tone="bg-forest-50 text-forest-700">{tasks} task{tasks === 1 ? "" : "s"}</Pill>
                      {r.status === "inactive" && <Pill tone="bg-sunken text-muted">Disabled</Pill>}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
        <Card title="New role" className="xl:sticky xl:top-6">
          <ActionForm action={createRole} className="space-y-4" resetOnSuccess>
            <Field label="Name"><Input name="name" placeholder="e.g. Cashier" required /></Field>
            <Field label="Description (optional)"><Input name="description" placeholder="What this role does" /></Field>
            <SubmitButton className="h-11 w-full">Create role</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
