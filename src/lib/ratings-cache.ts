import { revalidateTag } from "next/cache";
import { deleteRedisKeysByPattern } from "@/lib/redis-cache";
import { redisKey } from "@/lib/redis";

export const PLAYER_RATINGS_CACHE_TAG = "player-ratings";

export function invalidatePlayerRatings() {
  revalidateTag(PLAYER_RATINGS_CACHE_TAG);
  void deleteRedisKeysByPattern(`${redisKey("ratings:players:")}*`);
}
