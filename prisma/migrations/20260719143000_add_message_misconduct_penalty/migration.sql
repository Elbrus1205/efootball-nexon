INSERT INTO "ReliabilityPenaltyReason" (
  "id",
  "title",
  "description",
  "points",
  "scope",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'relpen_score_message_misconduct',
  'Мат, оскорбления и непристойное поведение',
  'Мат, оскорбления, угрозы, травля и иное непристойное поведение в личных или общих сообщениях платформы и турнира.',
  6, 'SCORE_SUBMISSION', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "points" = EXCLUDED."points",
  "scope" = EXCLUDED."scope",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "SiteContent" ("key", "body", "updatedAt")
SELECT 'regulations_previous', "body", "updatedAt"
FROM "SiteContent"
WHERE "key" = 'regulations'
  AND POSITION('Штраф за сообщения' IN "body") = 0
ON CONFLICT ("key") DO UPDATE SET
  "body" = EXCLUDED."body",
  "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "SiteContent" ("key", "body", "updatedAt")
VALUES (
  'regulations',
  E'Заполните здесь официальный регламент турниров: сроки, подтверждение матчей, правила переигровок, технические поражения и требования к скриншотам.\n\nШтраф за сообщения\nМат, оскорбления, унижение участников, угрозы, травля и иное непристойное поведение в личных или общих сообщениях платформы и турнира считаются нарушением. За подтвержденное нарушение снимается минус 6 баллов надежности. Штраф может быть применен к одному или обоим игрокам матча, если нарушение допущено обеими сторонами.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "body" = RTRIM("SiteContent"."body") || E'\n\nШтраф за сообщения\nМат, оскорбления, унижение участников, угрозы, травля и иное непристойное поведение в личных или общих сообщениях платформы и турнира считаются нарушением. За подтвержденное нарушение снимается минус 6 баллов надежности. Штраф может быть применен к одному или обоим игрокам матча, если нарушение допущено обеими сторонами.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE POSITION('Штраф за сообщения' IN "SiteContent"."body") = 0;
