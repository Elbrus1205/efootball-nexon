const ADJECTIVES = [
  "Swift",
  "Nova",
  "Prime",
  "Rapid",
  "Royal",
  "Silent",
  "Neon",
  "Frost",
  "Blaze",
  "Storm",
  "Sharp",
  "Ultra",
] as const;

const NOUNS = [
  "Falcon",
  "Ranger",
  "Striker",
  "Knight",
  "Phantom",
  "Rocket",
  "Titan",
  "Vortex",
  "Eagle",
  "Pulse",
  "Comet",
  "Legend",
] as const;

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function generateFallbackNickname(seed: string) {
  const hash = hashSeed(seed || "player");
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  const suffix = String((hash % 900) + 100);
  return `${adjective}${noun}${suffix}`;
}

export function getPlayerDisplayName(user: {
  id?: string | null;
  nickname?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  if (user.nickname?.trim()) return user.nickname.trim();

  const seed = user.id || user.email || user.name || "player";
  return generateFallbackNickname(seed);
}
