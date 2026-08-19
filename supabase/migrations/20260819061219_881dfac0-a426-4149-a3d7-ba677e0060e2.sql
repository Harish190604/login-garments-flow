CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers viewable by branch or admin" ON public.suppliers
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR branch_id IS NULL OR NOT (branch_id IS DISTINCT FROM get_user_branch(auth.uid())));

CREATE POLICY "Admins/managers manage suppliers" ON public.suppliers
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id);
ALTER TABLE public.customers ADD COLUMN birthday date;