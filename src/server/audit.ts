import "server-only";
import { db, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  entry: {
    businessId: string;
    employeeId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    detail?: string;
  },
  tx: Tx | typeof db = db,
) {
  await tx.insert(auditLog).values(entry);
}
