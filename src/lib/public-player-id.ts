import { randomInt } from "crypto";
import { db } from "@/lib/db";

export function createPublicPlayerIdCandidate() {
  return String(randomInt(1_000_000_000, 10_000_000_000));
}

export async function generateUniquePublicPlayerId() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const publicId = createPublicPlayerIdCandidate();
    const existing = await db.user.findUnique({
      where: { publicId },
      select: { id: true },
    });

    if (!existing) return publicId;
  }

  throw new Error("Could not generate unique player ID.");
}
