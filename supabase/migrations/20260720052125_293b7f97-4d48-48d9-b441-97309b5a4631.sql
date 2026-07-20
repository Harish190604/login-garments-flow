
-- 1. Add branch_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Soft-delete columns
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Helper: get user's branch
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT branch_id FROM public.profiles WHERE id = _user_id $$;

-- 4. Update handle_new_user: first user = admin; others = no role (admin assigns later)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END; $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Rewrite RLS policies for branch-scoped access

-- SALES: view own-branch or admin; hide soft-deleted
DROP POLICY IF EXISTS "Sales viewable" ON public.sales;
CREATE POLICY "Sales viewable by branch or admin" ON public.sales FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.has_role(auth.uid(), 'admin')
      OR branch_id IS NOT DISTINCT FROM public.get_user_branch(auth.uid())
    )
  );

-- Admin-only DELETE (soft delete uses UPDATE; keep policy for potential hard delete)
DROP POLICY IF EXISTS "Admins delete sales" ON public.sales;
CREATE POLICY "Admins delete sales" ON public.sales FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin UPDATE broadened (soft delete + debt adjustment through sales)
DROP POLICY IF EXISTS "Managers update sales" ON public.sales;
CREATE POLICY "Admins update sales" ON public.sales FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS: view own-branch or admin
DROP POLICY IF EXISTS "Products viewable" ON public.products;
DROP POLICY IF EXISTS "Products viewable by all authenticated" ON public.products;
CREATE POLICY "Products viewable by branch or admin" ON public.products FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR branch_id IS NOT DISTINCT FROM public.get_user_branch(auth.uid())
    OR branch_id IS NULL
  );

-- CUSTOMERS: hide soft-deleted from SELECT
DROP POLICY IF EXISTS "Customers viewable" ON public.customers;
CREATE POLICY "Customers viewable" ON public.customers FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'));

-- Admin can update debt / restore etc.
-- Existing "Staff update customers" policy already allows staff updates.

-- 6. Grants (defensive)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT ON public.products TO authenticated;
