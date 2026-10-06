import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CircleDotDashed,
  Clock3,
  Columns3,
  LayoutTemplate,
  ListChecks,
  ListTodo,
  Repeat,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { employees, jobRoles, taskTemplates, taskTemplateSubtasks } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormButton } from "@/components/form-button";
import { Avatar, Card, cx, Empty, Eyebrow, Field, Input, PageHeader, Person, Pill, Progress, Select, Textarea } from "@/components/ui";
import { DAY_SHORT, prettyDate } from "@/lib/format";
import { localTime, minutesBetween } from "@/lib/time";
import { dayOverview, today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { ensureForDay, listTasks, type TaskWithSubtasks } from "@/server/tasks";
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

function ago(d: Date | null) {
  if (!d) return "—";
  const m = minutesBetween(d, new Date());
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

const COLUMNS: { key: "not_started" | "in_progress" | "completed"; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "not_started", label: "Not started", icon: CircleDashed, tone: "text-faint" },
  { key: "in_progress", label: "In progress", icon: CircleDotDashed, tone: "text-late" },
  { key: "completed", label: "Done", icon: CircleCheck, tone: "text-ok" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { business, settings } = await requireManager();
  const view = (await searchParams).view === "templates" ? "templates" : "board";

  return (
    <>
      <PageHeader icon={ListTodo} title="Tasks" description="Daily work for every role, generated from templates." />
      <div className="-mt-1 mb-5 flex gap-6 border-b border-line text-[14px]">
        {[
          { key: "board", label: "Today's board", icon: Columns3, href: "/manage/tasks" },
          { key: "templates", label: "Templates", icon: LayoutTemplate, href: "/manage/tasks?view=templates" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cx(
              "-mb-px flex items-center gap-2 border-b-2 pb-3 pt-1 font-medium transition",
              view === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} /> {t.label}
          </Link>
        ))}
      </div>
      {view === "board" ? <Board businessId={business.id} settings={settings} /> : <Templates businessId={business.id} todayStr={today(settings)} />}
    </>
  );
}

async function Board({ businessId, settings }: { businessId: string; settings: Awaited<ReturnType<typeof requireManager>>["settings"] }) {
  const workDate = today(settings);
  const { rows } = await dayOverview(businessId, settings, workDate);
  await ensureForDay(rows);
  const [tasks, roles] = await Promise.all([
    listTasks({ businessId, workDate }),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, businessId)),
  ]);
  const person = (t: TaskWithSubtasks) => rows.find((r) => r.employee.id === t.employeeId)?.employee;
  const tz = settings.timezone;

  if (tasks.length === 0) {
    return (
      <Card>
        <Empty icon={ListChecks} title="No tasks today">
          <Link href="/manage/tasks?view=templates" className="font-medium text-ink underline">Create a template</Link> and it appears here for everyone it applies to.
        </Empty>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => (col.key === "completed" ? t.status === "completed" || t.status === "skipped" : t.status === col.key));
        return (
          <section key={col.key} className="rounded-[18px] border border-line bg-subtle p-2">
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
              <col.icon className={cx("h-4 w-4", col.tone)} strokeWidth={2} />
              <span className="text-[14px] font-medium">{col.label}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-line-strong bg-surface px-1.5 text-xs text-muted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <div className="rounded-[14px] border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-faint">Nothing here</div>}
              {items.map((t) => {
                const who = person(t);
                const role = roles.find((r) => r.id === who?.roleId)?.name;
                const done = t.subtasks.filter((s) => s.status === "completed").length;
                return (
                  <article key={t.id} className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
                    <header className="flex items-center gap-2.5 border-b border-line bg-subtle px-3.5 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-line-strong bg-surface">
                        <ListChecks className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t.title}</span>
                      {t.required && t.status !== "completed" && <Pill tone="bg-red-50 text-red-700 ring-red-200/70">Required</Pill>}
                      {who && <Avatar name={who.fullName} size="sm" />}
                    </header>
                    <dl className="space-y-2.5 px-3.5 py-3 text-[13px]">
                      <div className="grid grid-cols-[110px_1fr] items-center">
                        <dt className="flex items-center gap-2 text-muted"><UserRound className="h-4 w-4" strokeWidth={1.75} /> Assigned</dt>
                        <dd>{who ? <Person name={who.fullName} href={`/manage/staff/${who.id}`} size="xs" /> : "—"}</dd>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] items-center">
                        <dt className="flex items-center gap-2 text-muted"><Tags className="h-4 w-4" strokeWidth={1.75} /> Role</dt>
                        <dd>{role ? <Pill>{role}</Pill> : <span className="text-faint">—</span>}</dd>
                      </div>
                      {t.subtasks.length > 0 && (
                        <div className="grid grid-cols-[110px_1fr] items-center">
                          <dt className="flex items-center gap-2 text-muted"><ListChecks className="h-4 w-4" strokeWidth={1.75} /> Subtasks</dt>
                          <dd className="flex items-center gap-2">
                            <Progress value={done} max={t.subtasks.length} className="max-w-24" />
                            <span className="font-mono text-xs text-muted">{done}/{t.subtasks.length}</span>
                          </dd>
                        </div>
                      )}
                      <div className="grid grid-cols-[110px_1fr] items-center">
                        <dt className="flex items-center gap-2 text-muted"><CalendarClock className="h-4 w-4" strokeWidth={1.75} /> Started</dt>
                        <dd className="font-mono text-ink-2">{t.startedAt ? localTime(t.startedAt, tz) : "—"}</dd>
                      </div>
                    </dl>
                    <footer className="flex items-center justify-between border-t border-line px-3.5 py-2 text-xs text-muted">
                      <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> {t.subtasks.length || "No"} subtask{t.subtasks.length === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {t.status === "completed" ? `Done ${ago(t.completedAt)}` : ago(t.updatedAt)}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

async function Templates({ businessId, todayStr }: { businessId: string; todayStr: string }) {
  const [templates, subtasks, roles, staff] = await Promise.all([
    db.select().from(taskTemplates).where(eq(taskTemplates.businessId, businessId)).orderBy(asc(taskTemplates.title)),
    db.select().from(taskTemplateSubtasks).where(eq(taskTemplateSubtasks.businessId, businessId)).orderBy(asc(taskTemplateSubtasks.sortOrder)),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, businessId)).orderBy(asc(jobRoles.name)),
    db.select().from(employees).where(eq(employees.businessId, businessId)).orderBy(asc(employees.fullName)),
  ]);
  const target = (t: Template) =>
    t.roleId ? `Everyone: ${roles.find((r) => r.id === t.roleId)?.name ?? "?"}` : (staff.find((e) => e.id === t.employeeId)?.fullName ?? "?");

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-2.5">
        {templates.length === 0 ? (
          <Card><Empty icon={ListChecks} title="No templates yet">Create your first one on the right.</Empty></Card>
        ) : (
          templates.map((t) => {
            const subs = subtasks.filter((s) => s.taskTemplateId === t.id);
            return (
              <section key={t.id} className={cx("rounded-[18px] border border-line bg-subtle p-[3px]", t.status === "inactive" && "opacity-55")}>
                <div className="rounded-[15px] border border-line bg-surface shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
                    <Eyebrow>{t.roleId ? "Role task" : "Personal task"}</Eyebrow>
                    <Eyebrow>{t.required ? "Required" : "Optional"}</Eyebrow>
                  </div>
                  <div className="flex items-start gap-3 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line-strong bg-subtle"><ListChecks className="h-4 w-4 text-ink-2" strokeWidth={1.75} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-medium">{t.title}</h3>
                        {t.status === "inactive" && <Pill>Disabled</Pill>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Pill tone="bg-accent-50 text-accent-700 ring-accent-200/70">{t.roleId ? <Tags className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{target(t)}</Pill>
                        <Pill><Repeat className="h-3 w-3" />{describe(t)}</Pill>
                      </div>
                      {t.description && <p className="mt-2 text-[13px] text-muted">{t.description}</p>}
                      {subs.length > 0 && (
                        <ol className="mt-3 space-y-1.5">
                          {subs.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2 text-[13px] text-ink-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-line-strong font-mono text-[10px] text-muted">{i + 1}</span>
                              {s.title}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <form action={toggleTemplate}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <input type="hidden" name="status" value={t.status === "active" ? "inactive" : "active"} />
                      <FormButton variant="secondary" className="h-8 px-2.5 text-xs">{t.status === "active" ? "Disable" : "Enable"}</FormButton>
                    </form>
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>

      <Card title="New template" description="For everyone in a role, or one person." className="xl:sticky xl:top-0">
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
          <FrequencyFields today={todayStr} />
          <Field label="Subtasks (optional)" hint="One per line, in order.">
            <Textarea name="subtasks" rows={5} placeholder={"Check low-stock items\nBring stock from warehouse\nRefill shelves"} />
          </Field>
          <label className="flex items-center gap-2.5 text-[13px]">
            <input type="checkbox" name="required" defaultChecked className="h-4 w-4 accent-[var(--color-ink)]" /> Required (flagged on the dashboard if unfinished)
          </label>
          <SubmitButton className="w-full">Create template</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
