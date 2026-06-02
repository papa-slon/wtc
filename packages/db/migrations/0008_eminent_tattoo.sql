WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY request_id, kind
      ORDER BY CASE WHEN done = false THEN 0 ELSE 1 END, created_at ASC, id ASC
    ) AS rn
  FROM tradingview_access_tasks
)
DELETE FROM tradingview_access_tasks t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "tvat_request_kind_idx" ON "tradingview_access_tasks" USING btree ("request_id","kind");
