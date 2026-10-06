import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { ChevronRight, Lock, UserPlus, Users } from "lucide-react";
import { db } from "@/db";
import { attendance, employees, jobRoles } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Person, Pill, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { prettyDate } from "@/lib/format";
import { localDate, localTime } from "@/lib/time";
import { dayOverview, today } from "@/server/attendance";
import { requireManager } from "@/server/auth";
import { addStaff } from "../../actions";
import { SeniorPassword } from "./senior-password";

export default async function StaffPage() {
  const { business, settings } = await requireManager();
  const tz = settings.timezone;
  const [staff, roles, overview, last] = await Promise.all([
    db.select().from(employees).where(eq(employees.businessId, business.id)).orderBy(asc(employees.staffCode)),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
    dayOverview(business.id, settings, today(settings)),
    db
      .select({
        employeeId: attendance.employeeId,
        at: sql<Date>`max(coalesce(${attendance.clockOutAt}, ${attendance.clockInAt}))`.mapWith((v) => (v ? new Date(v) : null)),
      })
      .from(attendance)
      .where(and(eq(attendance.businessId, business.id)))
      .groupBy(attendance.employeeId),
  ]);
  const activeRoles = roles.filter((r) => r.status === "active");
  const active = staff.filter((e) => e.status === "active").length;
  const todayStr = today(settings);

  const lastActivity = (id: string) => {
    const at = last.find((l) => l.employeeId === id)?.at;
    if (!at) return <span className="text-faint">No activity yet</span>;
    const d = localDate(at, tz);
    return d === todayStr ? `Today, ${localTime(at, tz)}` : prettyDate(d);
  };

  return (
    <>
      <PageHeader icon={Users} title="Staff" description={`${active} active · ${staff.length - active} inactive`} />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Card flush>
          <Table minWidth={720}>
            <thead>
              <tr><Th>Name</Th><Th>Staff ID</Th><Th>Role</Th><Th>Today</Th><Th>Last activity</Th><Th /></tr>
            </thead>
            <tbody>
              {staff.map((e) => {
                const row = overview.rows.find((r) => r.employee.id === e.id);
                return (
                  <tr key={e.id} className="group hover:bg-subtle">
                    <Td>
                      <div className="flex items-center gap-2">
                        <Person name={e.fullName} href={`/manage/staff/${e.id}`} size="md" />
                        {e.level === "senior" && <Pill tone="bg-accent-50 text-accent-700 ring-accent-200/70">Senior</Pill>}
                        {e.lockedUntil && e.lockedUntil > new Date() && <Pill tone="bg-red-50 text-red-700 ring-red-200/70"><Lock className="h-3 w-3" /> Locked</Pill>}
                      </div>
                    </Td>
                    <Td><span className="rounded-md border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-xs">{e.staffCode}</span></Td>
                    <Td className="text-ink-2">{roles.find((r) => r.id === e.roleId)?.name ?? <span className="text-faint">No role</span>}</Td>
                    <Td>{e.status === "inactive" ? <Pill>Inactive</Pill> : row ? <StatusBadge status={row.result.status} /> : <span className="text-faint">—</span>}</Td>
                    <Td className="text-ink-2">{lastActivity(e.id)}</Td>
                    <Td className="w-8"><Link href={`/manage/staff/${e.id}`} className="text-faint group-hover:text-ink"><ChevronRight className="h-4 w-4" /></Link></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <Card title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-muted" /> Add staff</span>} description="A staff ID and 4-digit PIN are created for them." className="xl:sticky xl:top-0">
          <ActionForm action={addStaff} className="space-y-4" resetOnSuccess>
            <Field label="Full name"><Input name="fullName" required /></Field>
            <Field label="Role">
              <Select name="roleId" defaultValue="">
                <option value="">No role yet</option>
                {activeRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Field label="Phone (optional)"><Input name="phone" type="tel" /></Field>
            <SeniorPassword />
            <SubmitButton className="w-full" pendingLabel="Adding…">Add staff</SubmitButton>
          </ActionForm>
          {activeRoles.length === 0 && (
            <p className="mt-4 rounded-[10px] border border-line bg-subtle p-3 text-xs text-muted">Tip: <Link href="/manage/roles" className="font-medium text-ink underline">create roles</Link> first so tasks can be assigned by role.</p>
          )}
        </Card>
      </div>
    </>
  );
}
