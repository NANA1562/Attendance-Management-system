import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, jobRoles } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, Input, Pill, Select } from "@/components/ui";
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title={`Staff (${staff.length})`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="px-5 py-2">ID</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Level</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((e) => (
                <tr key={e.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-5 py-2.5 font-mono">{e.staffCode}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/manage/staff/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link>
                  </td>
                  <td className="px-2 py-2.5 capitalize">{e.level}</td>
                  <td className="px-2 py-2.5 text-stone-600">{roles.find((r) => r.id === e.roleId)?.name ?? "—"}</td>
                  <td className="px-5 py-2.5">
                    {e.status === "active" ? <Pill tone="bg-emerald-50 text-emerald-700">Active</Pill> : <Pill>Inactive</Pill>}
                    {e.lockedUntil && e.lockedUntil > new Date() && <Pill tone="bg-red-100 text-red-800">Locked</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add staff">
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
          <p className="text-xs text-stone-500">A staff ID and 4-digit PIN are generated. The PIN is shown once.</p>
          <SubmitButton className="w-full" pendingLabel="Adding…">Add staff</SubmitButton>
        </ActionForm>
        {activeRoles.length === 0 && (
          <p className="mt-3 text-xs text-stone-500">Tip: <Link href="/manage/roles" className="underline">create roles</Link> first so you can assign tasks by role.</p>
        )}
      </Card>
    </div>
  );
}
