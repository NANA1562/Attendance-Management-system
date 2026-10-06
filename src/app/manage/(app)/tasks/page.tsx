import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, jobRoles, taskTemplates, taskTemplateSubtasks } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ClipboardList, ListChecks, Repeat, Tags, UserRound } from "lucide-react";
import { FormButton } from "@/components/form-button";
import { Card, cx, Empty, Field, Input, PageHeader, Pill, Select, Textarea } from "@/components/ui";
import { DAY_SHORT, prettyDate } from "@/lib/format";
import { today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { createTemplate, toggleTemplate } from "../../actions";
import { FrequencyFields } from "./frequency-fields";

type Template = typeof taskTemplates.$inferSelect;

function describe(t: Template) {
  switch (t.frequency) {
    case "daily":
    case "shift_based":
      return "Every working day";
    case "weekly":
    case "specific_days":
      return (t.daysOfWeek ?? []).map((d) => DAY_SHORT[d]).join(", ");
    case "monthly":
      return `Monthly on day ${t.dayOfMonth}`;
    case "one_time":
      return `Once on ${t.oneTimeDate ? prettyDate(t.oneTimeDate) : "?"}`;
  }
}

export default async function TasksPage() {
  const { business, settings } = await requireManager();
  const [templates, subtasks, roles, staff] = await Promise.all([
    db.select().from(taskTemplates).where(eq(taskTemplates.businessId, business.id)).orderBy(asc(taskTemplates.title)),
    db.select().from(taskTemplateSubtasks).where(eq(taskTemplateSubtasks.businessId, business.id)).orderBy(asc(taskTemplateSubtasks.sortOrder)),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
    db.select().from(employees).where(eq(employees.businessId, business.id)).orderBy(asc(employees.fullName)),
  ]);
  const target = (t: Template) =>
    t.roleId ? `Everyone: ${roles.find((r) => r.id === t.roleId)?.name ?? "?"}` : (staff.find((e) => e.id === t.employeeId)?.fullName ?? "?");

  const active = templates.filter((t) => t.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Daily work"
        title="Tasks"
        description="Templates create each person's tasks every day they work. Editing or disabling a template never changes tasks already given out."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-ink-2">{active} active template{active === 1 ? "" : "s"}</div>
          {templates.length === 0 ? (
            <Card><Empty icon={ListChecks} title="No tasks yet">Create your first task template on the right.</Empty></Card>
          ) : (
            templates.map((t) => {
              const subs = subtasks.filter((s) => s.taskTemplateId === t.id);
              return (
                <section key={t.id} className={cx("rounded-2xl border border-line bg-surface p-5 shadow-card transition", t.status === "inactive" && "opacity-60")}>
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><ClipboardList className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold">{t.title}</h3>
                        {t.required && <Pill tone="bg-forest-800 text-white">Required</Pill>}
                        {t.status === "inactive" && <Pill tone="bg-sunken text-muted">Disabled</Pill>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                        <Pill tone="bg-gold-50 text-gold-700">{t.roleId ? <Tags className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{target(t)}</Pill>
                        <Pill><Repeat className="h-3 w-3" />{describe(t)}</Pill>
                      </div>
                      {t.description && <p className="mt-2 text-sm text-ink-2">{t.description}</p>}
                      {subs.length > 0 && (
                        <ol className="mt-3 space-y-1.5 border-l-2 border-line pl-4">
                          {subs.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2 text-sm text-ink-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sunken text-[11px] font-bold text-muted">{i + 1}</span>
                              {s.title}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <form action={toggleTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <input type="hidden" name="status" value={t.status === "active" ? "inactive" : "active"} />
                      <FormButton variant="ghost" className="px-3 py-1.5 text-xs">{t.status === "active" ? "Disable" : "Enable"}</FormButton>
                    </form>
                  </div>
                </section>
              );
            })
          )}
        </div>

        <Card title="New task" description="For everyone in a role, or one person." className="xl:sticky xl:top-6">
          <ActionForm action={createTemplate} className="space-y-4" resetOnSuccess>
            <Field label="Task"><Input name="title" placeholder="e.g. Restock beverage section" required /></Field>
            <Field label="Instructions (optional)"><Input name="description" /></Field>
            <Field label="For">
              <Select name="target" defaultValue="" required>
                <option value="" disabled>Choose a role or person…</option>
                {roles.some((r) => r.status === "active") && (
                  <optgroup label="Everyone in a role">
                    {roles.filter((r) => r.status === "active").map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name}</option>)}
                  </optgroup>
                )}
                <optgroup label="One person">
                  {staff.filter((e) => e.status === "active").map((e) => <option key={e.id} value={`employee:${e.id}`}>{e.fullName}</option>)}
                </optgroup>
              </Select>
            </Field>
            <FrequencyFields today={today(settings)} />
            <Field label="Subtasks (optional)" hint="One per line, in order.">
              <Textarea name="subtasks" rows={5} placeholder={"Check low-stock items\nBring stock from warehouse\nRefill shelves"} />
            </Field>
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" name="required" defaultChecked className="h-4 w-4 accent-[var(--color-forest-600)]" /> Required (shows on the dashboard if not finished)
            </label>
            <SubmitButton className="h-11 w-full">Create task</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
