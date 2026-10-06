CREATE TABLE "tap_photos" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"mime_type" text DEFAULT 'image/jpeg' NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "photo_on_tap" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tap_photos" ADD CONSTRAINT "tap_photos_event_id_attendance_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."attendance_events"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_photos" ADD CONSTRAINT "tap_photos_business_id_businesses_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_photos" ADD CONSTRAINT "tap_photos_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tap_photos_business_idx" ON "tap_photos" USING btree ("business_id","created_at");--> statement-breakpoint
-- Same lock-down as 0001: no access through Supabase's public API.
ALTER TABLE "tap_photos" ENABLE ROW LEVEL SECURITY;
