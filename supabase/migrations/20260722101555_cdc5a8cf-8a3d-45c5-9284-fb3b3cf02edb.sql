
-- 1) Product image URL
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- 2) Auto-generate a unique 12-digit barcode when missing
CREATE OR REPLACE FUNCTION public.set_product_barcode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE candidate text;
BEGIN
  IF NEW.barcode IS NULL OR length(trim(NEW.barcode)) = 0 THEN
    LOOP
      candidate := '2' || lpad(((floor(random() * 1e11))::bigint)::text, 11, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE barcode = candidate);
    END LOOP;
    NEW.barcode := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_product_barcode ON public.products;
CREATE TRIGGER trg_set_product_barcode BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_barcode();

UPDATE public.products SET barcode = NULL WHERE barcode = '';
DO $$ DECLARE r record; c text; BEGIN
  FOR r IN SELECT id FROM public.products WHERE barcode IS NULL LOOP
    LOOP
      c := '2' || lpad(((floor(random() * 1e11))::bigint)::text, 11, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE barcode = c);
    END LOOP;
    UPDATE public.products SET barcode = c WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Branch scope for customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

DROP POLICY IF EXISTS "Customers viewable" ON public.customers;
DROP POLICY IF EXISTS "Customers viewable by branch or admin" ON public.customers;
CREATE POLICY "Customers viewable by branch or admin" ON public.customers FOR SELECT
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR branch_id IS NULL
      OR NOT (branch_id IS DISTINCT FROM public.get_user_branch(auth.uid()))
    )
  );

-- 4) Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expenses viewable by branch or admin" ON public.expenses;
CREATE POLICY "Expenses viewable by branch or admin" ON public.expenses FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR NOT (branch_id IS DISTINCT FROM public.get_user_branch(auth.uid()))
  );
DROP POLICY IF EXISTS "Staff create expenses" ON public.expenses;
CREATE POLICY "Staff create expenses" ON public.expenses FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'cashier')
  );
DROP POLICY IF EXISTS "Admins/managers update expenses" ON public.expenses;
CREATE POLICY "Admins/managers update expenses" ON public.expenses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Admins delete expenses" ON public.expenses;
CREATE POLICY "Admins delete expenses" ON public.expenses FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Storage policies for product-images bucket (bucket already exists, private)
DROP POLICY IF EXISTS "Product images readable by staff" ON storage.objects;
CREATE POLICY "Product images readable by staff" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff upload product images" ON storage.objects;
CREATE POLICY "Staff upload product images" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff update product images" ON storage.objects;
CREATE POLICY "Staff update product images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));

DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;
CREATE POLICY "Admins delete product images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
