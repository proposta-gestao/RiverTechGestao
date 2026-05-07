-- Add order_position to stock_reasons
ALTER TABLE public.stock_reasons ADD COLUMN IF NOT EXISTS order_position INTEGER DEFAULT 0;

-- Optional: Initialize order_position for existing rows
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY empresa_id ORDER BY created_at) as nr
  FROM public.stock_reasons
)
UPDATE public.stock_reasons
SET order_position = numbered.nr
FROM numbered
WHERE public.stock_reasons.id = numbered.id;
