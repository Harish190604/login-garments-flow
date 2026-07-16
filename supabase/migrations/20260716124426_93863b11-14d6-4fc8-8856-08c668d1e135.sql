
-- Tighten permissive policies
DROP POLICY IF EXISTS "Staff can adjust stock" ON public.products;
CREATE POLICY "Staff adjust stock" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));

DROP POLICY IF EXISTS "Staff can create customers" ON public.customers;
CREATE POLICY "Staff create customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));

DROP POLICY IF EXISTS "Managers update customers" ON public.customers;
CREATE POLICY "Staff update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));

DROP POLICY IF EXISTS "Staff create sale items" ON public.sale_items;
CREATE POLICY "Staff create sale items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));

-- Lock down function execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
