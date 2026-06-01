import { Prisma, ProfileStatusApprovalStatus } from "@prisma/client";

export function getActiveProfileStatusWhere(now = new Date()): Prisma.UserProfileStatusWhereInput {
  return {
    approvalStatus: ProfileStatusApprovalStatus.APPROVED,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export function getSelectedProfileStatusWhere(now = new Date()): Prisma.UserProfileStatusWhereInput {
  return {
    ...getActiveProfileStatusWhere(now),
    selectedOrder: { not: null },
  };
}
