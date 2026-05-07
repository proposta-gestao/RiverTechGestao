-- Add usage limit and count to coupons table
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT NULL;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Optional: Comment to explain the columns
COMMENT ON COLUMN public.coupons.usage_limit IS 'Maximum number of times this coupon can be used. NULL means unlimited.';
COMMENT ON COLUMN public.coupons.usage_count IS 'Current number of times this coupon has been used.';

-- Function to atomically increment coupon usage
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = _coupon_id;
END;
$$;
