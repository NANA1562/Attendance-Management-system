import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Every business-owned table carries business_id so businesses stay isolated.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------- enums ----------

export const businessStatus = pgEnum("business_status", ["active", "suspended"]);
export const activeStatus = pgEnum("active_status", ["active", "inactive"]);
export const employeeLevel = pgEnum("employee_level", ["senior", "junior"]);
export const attendanceStatus = pgEnum("attendance_status", [
  "on_time",
  "grace",
  "late",
  "attendance_risk",
  "absent",
  "off_day",
  "worked_off_day",
  "on_leave",
]);
export const eventType = pgEnum("event_type", [
  "clock_in",
  "break_start",
  "break_end",
  "clock_out",
]);
export const leaveType = pgEnum("leave_type", ["annual", "sick", "permission", "other"]);
export const dayPart = pgEnum("day_part", ["full_day", "morning_off", "afternoon_off"]);
export const leaveStatus = pgEnum("leave_status", ["active", "cancelled"]);
export const frequency = pgEnum("frequency", [
  "daily",
  "weekly",
  "specific_days",
  "monthly",
  "one_time",
  "shift_based",
]);
export const workStatus = pgEnum("work_status", [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);
export const subtaskStatus = pgEnum("subtask_status", ["not_started", "completed", "skipped"]);

// ---------- 1. business ----------

export const businesses = pgTable("businesses", {
  id: uuid("business_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  businessCode: text("business_code").notNull().unique(),
  phone: text("phone"),
  status: businessStatus("status").notNull().default("active"),
  ...timestamps,
});

// ---------- 2. business settings (one row per business) ----------

export const businessSettings = pgTable("business_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  graceMinutes: integer("grace_minutes").notNull().default(35),
  lateUntilMinutes: integer("late_until_minutes").notNull().default(70),
  absentAfterMinutes: integer("absent_after_minutes").notNull().default(120),
  defaultBreakMinutes: integer("default_break_minutes").notNull().default(60),
  lockoutAttempts: integer("lockout_attempts").notNull().default(4),
  lockoutMinutes: integer("lockout_minutes").notNull().default(3),
  timezone: text("timezone").notNull().default("Africa/Accra"),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------- 3. job roles ----------

export const jobRoles = pgTable(
  "job_roles",
  {
    id: uuid("role_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: activeStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("job_roles_business_name_uq").on(t.businessId, t.name)],
);

// ---------- 4. employees ----------
// level = access (senior/junior). role = what they do. PINs are hashed; a
// manager resets a PIN and sees the new one once.

export const employees = pgTable(
  "employees",
  {
    id: uuid("employee_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffCode: text("staff_code").notNull(),
    fullName: text("full_name").notNull(),
    level: employeeLevel("level").notNull().default("junior"),
    roleId: uuid("role_id").references(() => jobRoles.id, { onDelete: "set null" }),
    pinHash: text("pin_hash").notNull(),
    passwordHash: text("password_hash"),
    badgeId: text("badge_id"),
    phone: text("phone"),
    status: activeStatus("status").notNull().default("active"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("employees_business_staff_code_uq").on(t.businessId, t.staffCode)],
);

// ---------- 5. schedules ----------
// Weekly rows use day_of_week (0 = Sunday … 6 = Saturday). One-off override
// rows use shift_date. Exactly one of the two is set. No night shifts.

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("schedule_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week"),
    shiftDate: date("shift_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    breakMinutes: integer("break_minutes").notNull().default(60),
    isDayOff: boolean("is_day_off").notNull().default(false),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    check(
      "schedules_one_kind",
      sql`(${t.dayOfWeek} IS NULL) <> (${t.shiftDate} IS NULL)`,
    ),
    check("schedules_dow_range", sql`${t.dayOfWeek} IS NULL OR ${t.dayOfWeek} BETWEEN 0 AND 6`),
    check(
      "schedules_times",
      sql`${t.isDayOff} OR (${t.startTime} IS NOT NULL AND ${t.endTime} IS NOT NULL AND ${t.endTime} > ${t.startTime})`,
    ),
    uniqueIndex("schedules_employee_dow_uq")
      .on(t.employeeId, t.dayOfWeek)
      .where(sql`${t.dayOfWeek} IS NOT NULL`),
    uniqueIndex("schedules_employee_date_uq")
      .on(t.employeeId, t.shiftDate)
      .where(sql`${t.shiftDate} IS NOT NULL`),
  ],
);

// ---------- 6. leave ----------

export const leave = pgTable(
  "leave",
  {
    id: uuid("leave_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveType: leaveType("leave_type").notNull(),
    dayPart: dayPart("day_part").notNull().default("full_day"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason"),
    status: leaveStatus("status").notNull().default("active"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    check("leave_dates", sql`${t.endDate} >= ${t.startDate}`),
    check(
      "leave_half_day_single_date",
      sql`${t.dayPart} = 'full_day' OR ${t.startDate} = ${t.endDate}`,
    ),
    index("leave_employee_idx").on(t.employeeId, t.startDate),
  ],
);

// ---------- 7. attendance (daily summary) ----------

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("attendance_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    scheduledStart: time("scheduled_start"),
    scheduledEnd: time("scheduled_end"),
    breakAllowanceMinutes: integer("break_allowance_minutes").notNull().default(0),
    clockInAt: timestamp("clock_in_at", { withTimezone: true }),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    status: attendanceStatus("status").notNull(),
    minutesLate: integer("minutes_late").notNull().default(0),
    earlyLeaveMinutes: integer("early_leave_minutes").notNull().default(0),
    breakMinutes: integer("break_minutes").notNull().default(0),
    hoursWorked: numeric("hours_worked", { precision: 5, scale: 2, mode: "number" }),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    undertimeMinutes: integer("undertime_minutes").notNull().default(0),
    lateReason: text("late_reason"),
    leaveId: uuid("leave_id").references(() => leave.id, { onDelete: "set null" }),
    isOverridden: boolean("is_overridden").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_employee_date_uq").on(t.employeeId, t.workDate),
    index("attendance_business_date_idx").on(t.businessId, t.workDate),
  ],
);

// ---------- 8. attendance events (each tap; voided, never deleted) ----------

export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: uuid("event_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    attendanceId: uuid("attendance_id")
      .notNull()
      .references(() => attendance.id, { onDelete: "cascade" }),
    eventType: eventType("event_type").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    deviceId: text("device_id"),
    isManual: boolean("is_manual").notNull().default(false),
    createdBy: uuid("created_by"),
    isVoided: boolean("is_voided").notNull().default(false),
    note: text("note"),
  },
  (t) => [index("attendance_events_attendance_idx").on(t.attendanceId, t.eventAt)],
);

// ---------- 9. activity definitions ----------

export const activityDefinitions = pgTable("activity_definitions", {
  id: uuid("activity_id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  assignedRoleId: uuid("assigned_role_id").references(() => jobRoles.id, {
    onDelete: "set null",
  }),
  frequency: frequency("frequency").notNull().default("daily"),
  isRequired: boolean("is_required").notNull().default(false),
  requiresStartEnd: boolean("requires_start_end").notNull().default(false),
  requiresCompletion: boolean("requires_completion").notNull().default(true),
  requiresNotes: boolean("requires_notes").notNull().default(false),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  status: activeStatus("status").notNull().default("active"),
  ...timestamps,
});

// ---------- 10. activity logs ----------

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("activity_log_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activityDefinitions.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: workStatus("status").notNull().default("not_started"),
    notes: text("notes"),
    photoReference: text("photo_reference"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_logs_employee_idx").on(t.employeeId, t.createdAt)],
);

// ---------- 11. task templates ----------
// Assigned to a role (everyone with that role gets it) or to one employee.
// weekly / specific_days use days_of_week; monthly uses day_of_month;
// one_time uses one_time_date. daily and shift_based = every working day.

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("task_template_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => jobRoles.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    frequency: frequency("frequency").notNull().default("daily"),
    daysOfWeek: smallint("days_of_week").array(),
    dayOfMonth: smallint("day_of_month"),
    oneTimeDate: date("one_time_date"),
    required: boolean("required").notNull().default(true),
    status: activeStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    check(
      "task_templates_target",
      sql`(${t.roleId} IS NULL) <> (${t.employeeId} IS NULL)`,
    ),
  ],
);

// ---------- 12. task template subtasks ----------

export const taskTemplateSubtasks = pgTable("task_template_subtasks", {
  id: uuid("subtask_template_id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  taskTemplateId: uuid("task_template_id")
    .notNull()
    .references(() => taskTemplates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  required: boolean("required").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- 13. daily tasks (snapshot of a template for one employee/day) ----------

export const dailyTasks = pgTable(
  "daily_tasks",
  {
    id: uuid("daily_task_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    taskTemplateId: uuid("task_template_id").references(() => taskTemplates.id, {
      onDelete: "set null",
    }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(true),
    status: workStatus("status").notNull().default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    assignedBy: uuid("assigned_by"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    // Generation is idempotent: one copy of a template per employee per day.
    uniqueIndex("daily_tasks_template_employee_date_uq").on(
      t.taskTemplateId,
      t.employeeId,
      t.workDate,
    ),
    index("daily_tasks_business_date_idx").on(t.businessId, t.workDate),
  ],
);

// ---------- 14. daily task subtasks ----------

export const dailyTaskSubtasks = pgTable("daily_task_subtasks", {
  id: uuid("daily_subtask_id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dailyTaskId: uuid("daily_task_id")
    .notNull()
    .references(() => dailyTasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  required: boolean("required").notNull().default(true),
  status: subtaskStatus("status").notNull().default("not_started"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- 15. audit log ----------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("log_id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_business_idx").on(t.businessId, t.createdAt)],
);
