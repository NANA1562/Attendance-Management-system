import { asc, eq } from "drizzle-orm";
import { Tags } from "lucide-react";
import { db } from "@/db";
import { employees, jobRoles, taskTemplates } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormButton } from "@/components/form-button";
import { Avatar, Card, cx, Empty, Eyebrow, Field, Input, PageHeader, Pill } from "@/components/ui";
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
      <PageHeader icon={Tags} title="Roles" description="What someone does, like Cashier. Separate from their level, which controls dashboard access." />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        {roles.length === 0 ? (
          <Card><Empty icon={Tags} title="No roles yet">Create your first role on the right.</Empty></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((r) => {
              const people = staff.filter((s) => s.roleId === r.id && s.status === "active");
              const tasks = templates.filter((t) => t.roleId === r.id && t.status === "active").length;
              return (
                <section key={r.id} className={cx("rounded-[18px] border border-line bg-subtle p-[3px]", r.status === "inactive" && "opacity-55")}>
                  <div className="flex h-full flex-col rounded-[15px] border border-line bg-surface shadow-card">
                    <div className="flex items-center justify-between border-b border-line px-4 py-2">
                      <Eyebrow>Role</Eyebrow>
                      <Eyebrow>{r.status === "active" ? "Active" : "Disabled"}</Eyebrow>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong bg-subtle"><Tags className="h-4 w-4 text-ink-2" strokeWidth={1.75} /></span>
                          <div>
                            <h3 className="text-[15px] font-semibold">{r.name}</h3>
                            {r.description && <p className="text-[13px] text-muted">{r.description}</p>}
                          </div>
                        </div>
                        <form action={toggleRole}>
                          <input type="hidden" name="roleId" value={r.id} />
                          <input type="hidden" name="status" value={r.status === "active" ? "inactive" : "active"} />
                          <FormButton variant="secondary" className="h-8 px-2.5 text-xs">{r.status === "active" ? "Disable" : "Enable"}</FormButton>
                        </form>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <div className="flex -space-x-1.5">
                          {people.slice(0, 5).map((p) => <Avatar key={p.fullName} name={p.fullName} size="sm" className="ring-2 ring-surface" />)}
                          {people.length === 0 && <span className="text-xs text-faint">No one yet</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <Pill>{people.length} staff</Pill>
                          <Pill tone="bg-accent-50 text-accent-700 ring-accent-200/70">{tasks} task{tasks === 1 ? "" : "s"}</Pill>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
        <Card title="New role" className="xl:sticky xl:top-0">
          <ActionForm action={createRole} className="space-y-4" resetOnSuccess>
            <Field label="Name"><Input name="name" placeholder="e.g. Cashier" required /></Field>
            <Field label="Description (optional)"><Input name="description" placeholder="What this role does" /></Field>
            <SubmitButton className="w-full">Create role</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
