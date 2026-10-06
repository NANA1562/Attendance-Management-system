CREATE TYPE "public"."active_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('on_time', 'grace', 'late', 'attendance_risk', 'absent', 'off_day', 'worked_off_day', 'on_leave');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."day_part" AS ENUM('full_day', 'morning_off', 'afternoon_off');--> statement-breakpoint
CREATE TYPE "public"."employee_level" AS ENUM('senior', 'junior');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('clock_in', 'break_start', 'break_end', 'clock_out');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'specific_days', 'monthly', 'one_time', 'shift_based');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'sick', 'permission', 'other');--> statement-breakpoint
CREATE TYPE "public"."subtask_status" AS ENUM('not_started', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('not_started', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "activity_definitions" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"assigned_role_id" uuid,
	"frequency" "frequency" DEFAULT 'daily' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"requires_start_end" boolean DEFAULT false NOT NULL,
	"requires_completion" boolean DEFAULT true NOT NULL,
	"requires_notes" boolean DEFAULT false NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"activity_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "work_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"photo_reference" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"attendance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"scheduled_start" time,
	"scheduled_end" time,
	"break_allowance_minutes" integer DEFAULT 0 NOT NULL,
	"clock_in_at" timestamp with time zone,
	"clock_out_at" timestamp with time zone,
	"status" "attendance_status" NOT NULL,
	"minutes_late" integer DEFAULT 0 NOT NULL,
	"early_leave_minutes" integer DEFAULT 0 NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"hours_worked" numeric(5, 2),
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"undertime_minutes" integer DEFAULT 0 NOT NULL,
	"late_reason" text,
	"leave_id" uuid,
	"is_overridden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"is_voided" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"grace_minutes" integer DEFAULT 35 NOT NULL,
	"late_until_minutes" integer DEFAULT 70 NOT NULL,
	"absent_after_minutes" integer DEFAULT 120 NOT NULL,
	"default_break_minutes" integer DEFAULT 60 NOT NULL,
	"lockout_attempts" integer DEFAULT 4 NOT NULL,
	"lockout_minutes" integer DEFAULT 3 NOT NULL,
	"timezone" text DEFAULT 'Africa/Accra' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"business_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"business_code" text NOT NULL,
	"phone" text,
	"status" "business_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_business_code_unique" UNIQUE("business_code")
);
--> statement-breakpoint
CREATE TABLE "daily_task_subtasks" (
	"daily_subtask_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"daily_task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"status" "subtask_status" DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"daily_task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"task_template_id" uuid,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT true NOT NULL,
	"status" "work_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"employee_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_code" text NOT NULL,
	"full_name" text NOT NULL,
	"level" "employee_level" DEFAULT 'junior' NOT NULL,
	"role_id" uuid,
	"pin_hash" text NOT NULL,
	"password_hash" text,
	"badge_id" text,
	"phone" text,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_roles" (
	"role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave" (
	"leave_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"day_part" "day_part" DEFAULT 'full_day' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_dates" CHECK ("leave"."end_date" >= "leave"."start_date"),
	CONSTRAINT "leave_half_day_single_date" CHECK ("leave"."day_part" = 'full_day' OR "leave"."start_date" = "leave"."end_date")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"schedule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_of_week" smallint,
	"shift_date" date,
	"start_time" time,
	"end_time" time,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"is_day_off" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_one_kind" CHECK (("schedules"."day_of_week" IS NULL) <> ("schedules"."shift_date" IS NULL)),
	CONSTRAINT "schedules_dow_range" CHECK ("schedules"."day_of_week" IS NULL OR "schedules"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "schedules_times" CHECK ("schedules"."is_day_off" OR ("schedules"."start_time" IS NOT NULL AND "schedules"."end_time" IS NOT NULL AND "schedules"."end_time" > "schedules"."start_time"))
);
--> statement-breakpoint
CREATE TABLE "task_template_subtasks" (
	"subtask_template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"task_template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"task_template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"role_id" uuid,
	"employee_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"frequency" "frequency" DEFAULT 'daily' NOT NULL,
	"days_of_week" smallint[],
	"day_of_month" smallint,
	"one_time_date" date,
	"required" boolean DEFAULT true NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_templates_target" CHECK (("task_templates"."role_id" IS NULL) <> ("task_templates"."employee_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "activity_definitions" ADD CONSTRAINT "activity_definitions_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_definitions" ADD CONSTRAINT "activity_definitions_assigned_role_id_job_roles_role_id_fk" FOREIGN KEY ("assigned_role_id") REFERENCES "public"."job_roles"("role_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_activity_id_activity_definitions_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_definitions"("activity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_leave_id_leave_leave_id_fk" FOREIGN KEY ("leave_id") REFERENCES "public"."leave"("leave_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_id_attendance_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("attendance_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_task_subtasks" ADD CONSTRAINT "daily_task_subtasks_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_task_subtasks" ADD CONSTRAINT "daily_task_subtasks_daily_task_id_daily_tasks_daily_task_id_fk" FOREIGN KEY ("daily_task_id") REFERENCES "public"."daily_tasks"("daily_task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_task_template_id_task_templates_task_template_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("task_template_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_job_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("role_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_subtasks" ADD CONSTRAINT "task_template_subtasks_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_subtasks" ADD CONSTRAINT "task_template_subtasks_task_template_id_task_templates_task_template_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("task_template_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_role_id_job_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("role_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_employee_idx" ON "activity_logs" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_date_uq" ON "attendance" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_business_date_idx" ON "attendance" USING btree ("business_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_events_attendance_idx" ON "attendance_events" USING btree ("attendance_id","event_at");--> statement-breakpoint
CREATE INDEX "audit_log_business_idx" ON "audit_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_tasks_template_employee_date_uq" ON "daily_tasks" USING btree ("task_template_id","employee_id","work_date");--> statement-breakpoint
CREATE INDEX "daily_tasks_business_date_idx" ON "daily_tasks" USING btree ("business_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_business_staff_code_uq" ON "employees" USING btree ("business_id","staff_code");--> statement-breakpoint
CREATE UNIQUE INDEX "job_roles_business_name_uq" ON "job_roles" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "leave_employee_idx" ON "leave" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_employee_dow_uq" ON "schedules" USING btree ("employee_id","day_of_week") WHERE "schedules"."day_of_week" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_employee_date_uq" ON "schedules" USING btree ("employee_id","shift_date") WHERE "schedules"."shift_date" IS NOT NULL;