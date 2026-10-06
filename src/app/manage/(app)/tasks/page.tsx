import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, jobRoles, taskTemplates, taskTemplateSubtasks } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, Field, Input, Pill, Select, Textarea } from "@/components/ui";
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
    t.roleId ? `Role: ${roles.find((r) => r.id === t.roleId)?.name ?? "?"}` : `Person: ${staff.find((e) => e.id === t.employeeId)?.fullName ?? "?"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card title="Task templates">
        <p className="mb-4 text-sm text-stone-600">
          Templates create each person's daily tasks. Changing or disabling a template doesn't change tasks already given out.
        </p>
        {templates.length === 0 ? (
          <p className="text-sm text-stone-500">No tasks yet.</p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => {
              const subs = subtasks.filter((s) => s.taskTemplateId === t.id);
              return (
                <li key={t.id} className={`rounded-lg border border-stone-200 p-4 ${t.status === "inactive" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {t.title} {t.required && <Pill tone="bg-stone-900 text-white">Required</Pill>}{" "}
                        {t.status === "inactive" && <Pill>Disabled</Pill>}
                      </div>
                      <div className="mt-0.5 text-xs text-stone-500">{target(t)} · {describe(t)}</div>
                      {t.description && <div className="mt-1 text-sm text-stone-600">{t.description}</div>}
                    </div>
                    <form action={toggleTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <input type="hidden" name="status" value={t.status === "active" ? "inactive" : "active"} />
                      <Button variant="secondary" className="px-3 py-1 text-xs">{t.status === "active" ? "Disable" : "Enable"}</Button>
                    </form>
                  </div>
                  {subs.length > 0 && (
                    <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-stone-700">
                      {subs.map((s) => <li key={s.id}>{s.title}</li>)}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="New task">
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" defaultChecked className="h-4 w-4" /> Required
          </label>
          <SubmitButton className="w-full">Create task</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
