import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChevronRight, Lock, UserPlus } from "lucide-react";
import { db } from "@/db";
import { employees, jobRoles } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Card, Field, Input, PageHeader, Pill, Select, Table, Td, Th } from "@/components/ui";
import { requireManager } from "@/server/auth";
import { addStaff } from "../../actions";
import { SeniorPassword } from "./senior-password";

export default async function StaffPage() {
  const { business } = await requireManager();
  const [staff, roles] = await Promise.all([
    db.select().from(employees).where(eq(employees.businessId, business.id)).orderBy(asc(employees.staffCode)),
    db.select().from(jobRoles).where(eq(jobRoles.businessId, business.id)).orderBy(asc(jobRoles.name)),
  ]);
  const activeRoles = roles.filter((r) => r.status === "active");
  const active = staff.filter((e) => e.status === "active").length;

  return (
    <>
      <PageHeader eyebrow="Team" title="Staff" description={`${active} active · ${staff.length - active} inactive. Click a person to edit their schedule, leave and access.`} />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <Card padded>
          <Table minWidth={560}>
            <thead className="border-b border-line">
              <tr><Th>Person</Th><Th>Staff ID</Th><Th>Level</Th><Th>Role</Th><Th>Status</Th><Th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((e) => (
                <tr key={e.id} className="group hover:bg-canvas/60">
                  <Td>
                    <Link href={`/manage/staff/${e.id}`} className="flex items-center gap-3">
                      <Avatar name={e.fullName} />
                      <div>
                        <div className="font-semibold group-hover:underline">{e.fullName}</div>
                        {e.phone && <div className="text-xs text-muted">{e.phone}</div>}
                      </div>
                    </Link>
                  </Td>
                  <Td><span className="rounded-md bg-sunken px-2 py-1 font-mono text-xs font-bold">{e.staffCode}</span></Td>
                  <Td>{e.level === "senior" ? <Pill tone="bg-gold-100 text-gold-700">Senior</Pill> : <Pill>Junior</Pill>}</Td>
                  <Td className="text-ink-2">{roles.find((r) => r.id === e.roleId)?.name ?? <span className="text-muted">No role</span>}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {e.status === "active" ? <Pill tone="bg-forest-50 text-forest-700">Active</Pill> : <Pill tone="bg-sunken text-muted">Inactive</Pill>}
                      {e.lockedUntil && e.lockedUntil > new Date() && <Pill tone="bg-red-50 text-absent"><Lock className="h-3 w-3" /> Locked</Pill>}
                    </div>
                  </Td>
                  <Td><Link href={`/manage/staff/${e.id}`} className="text-muted group-hover:text-ink"><ChevronRight className="h-4 w-4" /></Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-gold-600" /> Add staff</span>} description="A staff ID and 4-digit PIN are created for them." className="xl:sticky xl:top-6">
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
            <SubmitButton className="h-11 w-full" pendingLabel="Adding…">Add staff</SubmitButton>
          </ActionForm>
          {activeRoles.length === 0 && (
            <p className="mt-4 rounded-xl bg-gold-50 p-3 text-xs text-gold-700">Tip: <Link href="/manage/roles" className="font-semibold underline">create roles</Link> first so tasks can be assigned by role.</p>
          )}
        </Card>
      </div>
    </>
  );
}
