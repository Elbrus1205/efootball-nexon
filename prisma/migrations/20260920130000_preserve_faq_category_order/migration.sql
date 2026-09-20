-- Freeze the currently visible section order independently of question positions.
-- Draft-only sections follow the published sections. Preserve any admin setting.
WITH first_questions AS (
  SELECT DISTINCT ON ("category") "id", "category", "isPublished", "sortOrder", "createdAt"
  FROM "FaqItem"
  ORDER BY "category", "isPublished" DESC, "sortOrder", "createdAt", "id"
)
INSERT INTO "SiteContent" ("key", "body", "updatedAt")
SELECT 'faq:category-order',
       COALESCE(jsonb_agg("category" ORDER BY "isPublished" DESC,
         CASE WHEN "isPublished" THEN "sortOrder" END,
         CASE WHEN "isPublished" THEN "createdAt" END,
         CASE WHEN "isPublished" THEN "id" END, "category"), '[]'::jsonb)::text,
       CURRENT_TIMESTAMP
FROM first_questions
ON CONFLICT ("key") DO NOTHING;
