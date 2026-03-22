import { AdminActionType } from "@prisma/client";
import { db } from "@/lib/db";

export async function logAdminAction(input: {
  adminId: string;
  tournamentId?: string | null;
  entityType: string;
  entityId: string;
  actionType: AdminActionType;
  beforeJson?: unknown;
  afterJson?: unknown;
}) {
  return db.adminAction.create({
    data: {
      adminId: input.adminId,
      tournamentId: input.tournamentId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      actionType: input.actionType,
      beforeJson: input.beforeJson as never,
      afterJson: input.afterJson as never,
    },
  });
}
