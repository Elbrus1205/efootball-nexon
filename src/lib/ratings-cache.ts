import { revalidateTag } from "next/cache";

export const PLAYER_RATINGS_CACHE_TAG = "player-ratings";

export function invalidatePlayerRatings() {
  revalidateTag(PLAYER_RATINGS_CACHE_TAG);
}
