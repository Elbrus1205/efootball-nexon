type ParticipantClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

export type ParticipantClubAssignment = {
  clubSlug: string;
  clubName: string;
  clubBadgePath: string;
};

export function shuffleParticipants<T>(items: readonly T[], random: () => number = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function resolveParticipantClub(
  selectedSlug: string | null | undefined,
  clubs: readonly ParticipantClubOption[],
): ParticipantClubAssignment {
  const slug = selectedSlug?.trim();
  if (!slug) throw new Error("Выберите клуб участника.");

  const club = clubs.find((option) => option.slug === slug);
  if (!club) throw new Error("Клуб не найден в списке доступных клубов.");

  return {
    clubSlug: club.slug,
    clubName: club.name,
    clubBadgePath: club.imagePath,
  };
}

type RatingParticipant = {
  userId: string;
  rosterMembers: readonly { userId: string }[];
};

type SeededParticipant = {
  id: string;
  groupId?: string | null;
};

type SeedGroup = {
  id: string;
  capacity: number;
};

export function assignParticipantsByGroupCapacity<T extends SeededParticipant>(
  participants: readonly T[],
  groups: readonly SeedGroup[],
  options: { preserveExisting?: boolean } = {},
) {
  const capacities = new Map(groups.map((group) => [group.id, Math.max(0, group.capacity)]));
  const assignedCounts = new Map(groups.map((group) => [group.id, 0]));
  const groupIdByParticipantId = new Map<string, string>();

  if (participants.length > Array.from(capacities.values()).reduce((total, capacity) => total + capacity, 0)) {
    throw new Error("В группах недостаточно мест для всех участников.");
  }

  if (options.preserveExisting) {
    for (const participant of participants) {
      const groupId = participant.groupId;
      if (!groupId || !capacities.has(groupId)) continue;

      const assignedCount = assignedCounts.get(groupId) ?? 0;
      if (assignedCount >= (capacities.get(groupId) ?? 0)) continue;

      groupIdByParticipantId.set(participant.id, groupId);
      assignedCounts.set(groupId, assignedCount + 1);
    }
  }

  for (const participant of participants) {
    if (groupIdByParticipantId.has(participant.id)) continue;

    const group = groups.find(
      (candidate) => (assignedCounts.get(candidate.id) ?? 0) < (capacities.get(candidate.id) ?? 0),
    );
    if (!group) throw new Error("В группах недостаточно мест для всех участников.");

    groupIdByParticipantId.set(participant.id, group.id);
    assignedCounts.set(group.id, (assignedCounts.get(group.id) ?? 0) + 1);
  }

  return participants.map((participant, index) => ({
    participant,
    groupId: groupIdByParticipantId.get(participant.id)!,
    seed: index + 1,
  }));
}

export function orderParticipantsByRating<T extends RatingParticipant>(
  participants: readonly T[],
  ratingByUserId: ReadonlyMap<string, number>,
) {
  return participants
    .map((participant, index) => {
      const rosterUserIds = Array.from(new Set(participant.rosterMembers.map((member) => member.userId)));
      const userIds = rosterUserIds.length ? rosterUserIds : [participant.userId];
      const totalRating = userIds.reduce((sum, userId) => sum + (ratingByUserId.get(userId) ?? 0), 0);
      return { participant, index, rating: totalRating / userIds.length };
    })
    .sort((left, right) => right.rating - left.rating || left.index - right.index)
    .map(({ participant }) => participant);
}
