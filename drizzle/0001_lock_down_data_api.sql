-- The app talks to Postgres directly from the server (as the postgres role,
-- which bypasses RLS). Enabling RLS with no policies blocks Supabase's public
-- REST/GraphQL API (anon/authenticated roles) from reading or writing anything.
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leave" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_template_subtasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_task_subtasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
