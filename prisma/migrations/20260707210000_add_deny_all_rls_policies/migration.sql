DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'Account',
    'AdminAction',
    'BracketSlot',
    'DivisionMatch',
    'DivisionMatchHistory',
    'DivisionPlayer',
    'DivisionQueueEntry',
    'DivisionScoreSubmission',
    'DivisionSeason',
    'DivisionSeasonArchive',
    'DivisionSettings',
    'EmailVerificationCode',
    'FaqAttachment',
    'FaqItem',
    'GroupStanding',
    'LoginHistory',
    'Match',
    'MatchLineupPlayer',
    'MatchResultSubmission',
    'MatchSchedule',
    'Notification',
    'PasswordResetToken',
    'PlayoffBracket',
    'ReliabilityEvent',
    'ReliabilityPenaltyReason',
    'RolePermission',
    'RoundDeadline',
    'Season',
    'SecuritySession',
    'Session',
    'SiteContent',
    'Tournament',
    'TournamentGroup',
    'TournamentRegistration',
    'TournamentRegistrationMember',
    'TournamentStage',
    'TwinAccountAlert',
    'TwoFactorChallenge',
    'User',
    'UserAchievement',
    'UserProfileStatus',
    'UserWarning',
    'VerificationToken',
    '_prisma_migrations'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = to_regclass(format('public.%I', table_name))
          AND polname = 'deny_all_public_access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY deny_all_public_access ON public.%I AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false)',
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;
