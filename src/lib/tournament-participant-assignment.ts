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
