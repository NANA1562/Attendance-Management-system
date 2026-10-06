import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { dailyTasks, dailyTaskSubtasks, taskTemplates, taskTemplateSubtasks } from "@/db/schema";
import { isTemplateDue } from "@/lib/tasks/due";
import type { Employee } from "./auth";
import type { DayRow } from "./attendance";

export type DailyTask = typeof dailyTasks.$inferSelect;
export type DailySubtask = typeof dailyTaskSubtasks.$inferSelect;
export type TaskWithSubtasks = DailyTask & { subtasks: DailySubtask[] };

const isWorkingDay = (row: DayRow) => row.plan.kind === "working" || !!row.result.clockInAt;

/**
 * Create the day's tasks for each employee from their role's templates and
 * any templates assigned to them directly. Each daily task is a snapshot, so
 * editing a template later never changes past days.
 *
 * Called on every dashboard/tablet view, so the common case (nothing new to
 * create) costs one round trip and no writes. The unique (template, employee,
 * date) index still guards against two views racing to create the same task.
 */
export async function ensureForDay(rows: DayRow[]) {
  if (rows.length === 0) return;
  const { businessId } = rows[0].employee;
  const workDate = rows[0].workDate;
  const employeeIds = rows.map((r) => r.employee.id);

  const [templates, existing] = await Promise.all([
    db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.businessId, businessId), eq(taskTemplates.status, "active"))),
    db
      .select({ templateId: dailyTasks.taskTemplateId, employeeId: dailyTasks.employeeId })
      .from(dailyTasks)
      .where(and(eq(dailyTasks.workDate, workDate), inArray(dailyTasks.employeeId, employeeIds))),
  ]);
  const have = new Set(existing.map((e) => `${e.templateId}:${e.employeeId}`));

  const missing = rows.flatMap((row) =>
    templates
      .filter(
        (t) =>
          (t.employeeId === row.employee.id || (!!t.roleId && t.roleId === row.employee.roleId)) &&
          isTemplateDue(t, workDate, isWorkingDay(row)) &&
          !have.has(`${t.id}:${row.employee.id}`),
      )
      .map((t) => ({ template: t, employeeId: row.employee.id })),
  );
  if (missing.length === 0) return;

  const subtasks = await db
    .select()
    .from(taskTemplateSubtasks)
    .where(inArray(taskTemplateSubtasks.taskTemplateId, [...new Set(missing.map((m) => m.template.id))]))
    .orderBy(asc(taskTemplateSubtasks.sortOrder));

  await db.transaction(async (tx) => {
    const created = await tx
      .insert(dailyTasks)
      .values(
        missing.map(({ template: t, employeeId }) => ({
          businessId,
          taskTemplateId: t.id,
          employeeId,
          workDate,
          title: t.title,
          description: t.description,
          required: t.required,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: dailyTasks.id, templateId: dailyTasks.taskTemplateId });

    const subRows = created.flatMap((task) =>
      subtasks
        .filter((s) => s.taskTemplateId === task.templateId)
        .map((s) => ({ businessId, dailyTaskId: task.id, title: s.title, required: s.required, sortOrder: s.sortOrder })),
    );
    if (subRows.length) await tx.insert(dailyTaskSubtasks).values(subRows);
  });
}

/** Daily tasks with their subtasks, for one employee or a whole business. */
export async function listTasks(filter: { businessId: string; workDate: string; employeeId?: string }) {
  const tasks = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.businessId, filter.businessId),
        eq(dailyTasks.workDate, filter.workDate),
        filter.employeeId ? eq(dailyTasks.employeeId, filter.employeeId) : undefined,
      ),
    )
    .orderBy(asc(dailyTasks.createdAt));
  if (tasks.length === 0) return [];
  const subs = await db
    .select()
    .from(dailyTaskSubtasks)
    .where(
      inArray(
        dailyTaskSubtasks.dailyTaskId,
        tasks.map((t) => t.id),
      ),
    )
    .orderBy(asc(dailyTaskSubtasks.sortOrder));
  return tasks.map((t) => ({ ...t, subtasks: subs.filter((s) => s.dailyTaskId === t.id) }));
}

/** Derive a task's status from its subtasks. */
function statusFromSubtasks(subs: DailySubtask[]): DailyTask["status"] {
  if (subs.length === 0) return "not_started";
  const finished = subs.every((s) => s.status !== "not_started");
  if (finished) return subs.some((s) => s.status === "completed") ? "completed" : "skipped";
  return subs.some((s) => s.status !== "not_started") ? "in_progress" : "not_started";
}

/** Tick or untick a subtask; the parent task's status follows. */
export async function setSubtask(employee: Employee, subtaskId: string, done: boolean) {
  await db.transaction(async (tx) => {
    const [sub] = await tx
      .select({ s: dailyTaskSubtasks, t: dailyTasks })
      .from(dailyTaskSubtasks)
      .innerJoin(dailyTasks, eq(dailyTasks.id, dailyTaskSubtasks.dailyTaskId))
      .where(and(eq(dailyTaskSubtasks.id, subtaskId), eq(dailyTasks.employeeId, employee.id)));
    if (!sub) return;

    const now = new Date();
    await tx
      .update(dailyTaskSubtasks)
      .set({ status: done ? "completed" : "not_started", completedAt: done ? now : null })
      .where(eq(dailyTaskSubtasks.id, subtaskId));

    const subs = await tx.select().from(dailyTaskSubtasks).where(eq(dailyTaskSubtasks.dailyTaskId, sub.t.id));
    const status = statusFromSubtasks(subs);
    await tx
      .update(dailyTasks)
      .set({
        status,
        startedAt: sub.t.startedAt ?? (status === "not_started" ? null : now),
        completedAt: status === "completed" ? (sub.t.completedAt ?? now) : null,
      })
      .where(eq(dailyTasks.id, sub.t.id));
  });
}

/** Set status directly — for tasks without subtasks, or to skip a task. */
export async function setTaskStatus(employee: Employee, taskId: string, status: DailyTask["status"]) {
  const now = new Date();
  const [task] = await db
    .select()
    .from(dailyTasks)
    .where(and(eq(dailyTasks.id, taskId), eq(dailyTasks.employeeId, employee.id)));
  if (!task) return;
  await db
    .update(dailyTasks)
    .set({
      status,
      startedAt: status === "not_started" ? null : (task.startedAt ?? now),
      completedAt: status === "completed" ? now : null,
    })
    .where(eq(dailyTasks.id, taskId));
}

export function taskCounts(tasks: TaskWithSubtasks[]) {
  return {
    assigned: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
    skipped: tasks.filter((t) => t.status === "skipped").length,
    requiredOpen: tasks.filter((t) => t.required && t.status !== "completed").length,
  };
}

