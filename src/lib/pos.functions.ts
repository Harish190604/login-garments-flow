import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, branch_id, branches(name,code)").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r: any) => r.role);
    return {
      id: userId,
      full_name: prof?.full_name ?? null,
      email: prof?.email ?? null,
      branch_id: prof?.branch_id ?? null,
      branch: (prof as any)?.branches ?? null,
      roles: roleList,
      is_admin: roleList.includes("admin"),
    };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [today, week, month, low, outstanding, recent, branches] = await Promise.all([
      supabase.from("sales").select("total,created_at").is("deleted_at", null).gte("created_at", startToday),
      supabase.from("sales").select("total,created_at").is("deleted_at", null).gte("created_at", startWeek),
      supabase.from("sales").select("total").is("deleted_at", null).gte("created_at", startMonth),
      supabase.from("products").select("id,name,current_stock,minimum_stock").lte("current_stock", 10).order("current_stock", { ascending: true }).limit(10),
      supabase.from("customers").select("outstanding_debt").is("deleted_at", null),
      supabase.from("sales").select("id,invoice_number,total,payment_method,created_at,customers(name)").is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
      supabase.from("branches").select("id,name,code"),
    ]);

    const sum = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
    const pendingDebts = (outstanding.data ?? []).reduce((s, r) => s + Number(r.outstanding_debt ?? 0), 0);

    // Sales chart last 7 days
    const days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, total: 0 });
    }
    (week.data ?? []).forEach((r: any) => {
      const key = new Date(r.created_at ?? Date.now()).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.date === key);
      if (bucket) bucket.total += Number(r.total ?? 0);
    });

    return {
      todaySales: sum(today.data),
      todayCount: today.data?.length ?? 0,
      weekSales: sum(week.data),
      monthSales: sum(month.data),
      lowStock: low.data ?? [],
      pendingDebts,
      recent: recent.data ?? [],
      branches: branches.data ?? [],
      chart: days,
    };
  });

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; branchId?: string | null }) => d)
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("products")
      .select("*, categories(name), branches(name,code)")
      .order("created_at", { ascending: false });
    if (data?.search) q = q.or(`name.ilike.%${data.search}%,sku.ilike.%${data.search}%,barcode.eq.${data.search}`);
    if (data?.branchId) q = q.eq("branch_id", data.branchId);
    const { data: rows, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("categories").select("*").order("name");
    return data ?? [];
  });

export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("branches").select("*").order("name");
    return data ?? [];
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("customers").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
    return data ?? [];
  });

const productInput = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1),
  category_id: z.string().uuid().optional().nullable(),
  brand: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  purchase_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
  gst_percent: z.number().min(0).max(100),
  discount_percent: z.number().min(0).max(100),
  current_stock: z.number().int().nonnegative(),
  minimum_stock: z.number().int().nonnegative(),
  branch_id: z.string().uuid().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
});

const productInputWithSupplier = productInput.extend({
  supplier_id: z.string().uuid().optional().nullable(),
});

/* ---------------- Suppliers ---------------- */

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("suppliers")
      .select("*, branches(name,code)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const supplierInput = z.object({
  name: z.string().min(1),
  contact_person: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
});

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supplierInput.parse(d))
  .handler(async ({ context, data }) => {
    const payload = { ...data, email: data.email || null };
    const { data: row, error } = await context.supabase.from("suppliers").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supplierInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("suppliers")
      .update({ ...patch, email: patch.email || null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("suppliers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Customers whose birthday falls within the next `days` days (default 3). */
export const listUpcomingBirthdays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => ({ days: d?.days ?? 3 }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("customers")
      .select("id, name, phone, birthday, loyalty_points")
      .is("deleted_at", null)
      .not("birthday", "is", null)
      .limit(1000);
    if (error) throw new Error(error.message);
    const today = new Date();
    const msDay = 86400000;
    const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return (rows ?? [])
      .map((c: any) => {
        const b = new Date(c.birthday);
        let next = Date.UTC(today.getFullYear(), b.getUTCMonth(), b.getUTCDate());
        if (next < startOfToday) next = Date.UTC(today.getFullYear() + 1, b.getUTCMonth(), b.getUTCDate());
        return { ...c, days_until: Math.round((next - startOfToday) / msDay) };
      })
      .filter((c: any) => c.days_until <= data.days)
      .sort((a: any, b: any) => a.days_until - b.days_until);
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productInputWithSupplier.parse(d))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase.from("products").insert(data).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1), description: z.string().optional().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase.from("categories").insert(data).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable().or(z.literal("")),
      address: z.string().optional().nullable(),
      birthday: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("branch_id").eq("id", userId).maybeSingle();
    const payload = { ...data, email: data.email || null, birthday: data.birthday || null, branch_id: prof?.branch_id ?? null };
    const { error, data: row } = await context.supabase.from("customers").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable().or(z.literal("")),
      address: z.string().optional().nullable(),
      birthday: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("customers")
      .update({ ...patch, email: patch.email || null, birthday: patch.birthday || null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const saleInput = z.object({
  branch_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  payment_method: z.string(),
  paid: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    sku: z.string().optional().nullable(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    gst_percent: z.number().min(0).max(100),
    discount_percent: z.number().min(0).max(100).default(0),
  })).min(1),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saleInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Enforce branch: non-admin cashiers can only bill for their own branch
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("branch_id").eq("id", userId).maybeSingle(),
    ]);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const effectiveBranch = isAdmin ? (data.branch_id ?? prof?.branch_id ?? null) : (prof?.branch_id ?? null);
    if (!isAdmin && !effectiveBranch) {
      throw new Error("No branch assigned. Ask an admin to assign your branch in Users.");
    }

    // Compute totals
    let subtotal = 0;
    let tax = 0;
    const itemsPersist = data.items.map((it) => {
      const gross = it.unit_price * it.quantity;
      const afterDisc = gross * (1 - it.discount_percent / 100);
      const gstAmt = afterDisc * (it.gst_percent / 100);
      const line = afterDisc + gstAmt;
      subtotal += afterDisc;
      tax += gstAmt;
      return { ...it, line_total: Number(line.toFixed(2)) };
    });
    const total = Number((subtotal + tax - data.discount).toFixed(2));
    const balance = Number((total - data.paid).toFixed(2));

    const invoice_number = `LG-${Date.now().toString().slice(-8)}`;

    const { data: sale, error } = await supabase.from("sales").insert({
      invoice_number,
      branch_id: effectiveBranch,
      customer_id: data.customer_id ?? null,
      cashier_id: userId,
      subtotal: Number(subtotal.toFixed(2)),
      discount: data.discount,
      tax: Number(tax.toFixed(2)),
      total,
      paid: data.paid,
      balance,
      payment_method: data.payment_method,
      status: balance > 0 ? "partial" : "completed",
      notes: data.notes ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);

    const { error: itemsErr } = await supabase
      .from("sale_items")
      .insert(itemsPersist.map((it) => ({ ...it, sale_id: sale.id })));
    if (itemsErr) throw new Error(itemsErr.message);

    // Decrement stock
    for (const it of data.items) {
      const { data: prod } = await supabase.from("products").select("current_stock").eq("id", it.product_id).single();
      if (prod) {
        await supabase.from("products").update({ current_stock: Math.max(0, (prod.current_stock ?? 0) - it.quantity) }).eq("id", it.product_id);
      }
    }

    // Outstanding debt on customer
    if (balance > 0 && data.customer_id) {
      const { data: cust } = await supabase.from("customers").select("outstanding_debt,loyalty_points").eq("id", data.customer_id).single();
      await supabase.from("customers").update({
        outstanding_debt: Number(cust?.outstanding_debt ?? 0) + balance,
        loyalty_points: Number(cust?.loyalty_points ?? 0) + Math.floor(total / 100),
      }).eq("id", data.customer_id);
    } else if (data.customer_id) {
      const { data: cust } = await supabase.from("customers").select("loyalty_points").eq("id", data.customer_id).single();
      await supabase.from("customers").update({
        loyalty_points: Number(cust?.loyalty_points ?? 0) + Math.floor(total / 100),
      }).eq("id", data.customer_id);
    }

    return { sale, items: itemsPersist };
  });

// ---------- Stock Transfer ----------

const transferInput = z.object({
  source_branch_id: z.string().uuid(),
  dest_branch_id: z.string().uuid(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export const listBranchProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { branchId: string }) => z.object({ branchId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("products")
      .select("id, sku, name, current_stock, branch_id, selling_price, purchase_price, gst_percent, discount_percent, minimum_stock, category_id, brand, color, size, barcode")
      .eq("branch_id", data.branchId)
      .gt("current_stock", 0)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const transferStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => transferInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.source_branch_id === data.dest_branch_id) {
      throw new Error("Source and destination branches must be different");
    }

    const { data: destBranch, error: destErr } = await supabase
      .from("branches").select("id, code, name").eq("id", data.dest_branch_id).single();
    if (destErr || !destBranch) throw new Error("Destination branch not found");

    const results: Array<{ product_id: string; quantity: number; dest_product_id: string }> = [];

    for (const item of data.items) {
      const { data: src, error: srcErr } = await supabase
        .from("products").select("*").eq("id", item.product_id).single();
      if (srcErr || !src) throw new Error(`Product not found: ${item.product_id}`);
      if (src.branch_id !== data.source_branch_id) throw new Error(`Product ${src.name} is not in the source branch`);
      if ((src.current_stock ?? 0) < item.quantity) throw new Error(`Not enough stock for ${src.name} (have ${src.current_stock})`);

      // Find or create a paired product row at destination branch.
      // SKU is globally unique, so we suffix with the destination branch code.
      const destSku = `${src.sku}-${destBranch.code}`;
      let destProductId: string | null = null;

      const { data: existing } = await supabase
        .from("products").select("id, current_stock").eq("sku", destSku).maybeSingle();

      if (existing) {
        destProductId = existing.id;
        const { error: updErr } = await supabase
          .from("products")
          .update({ current_stock: (existing.current_stock ?? 0) + item.quantity, branch_id: data.dest_branch_id })
          .eq("id", existing.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("products").insert({
            sku: destSku,
            barcode: null,
            name: src.name,
            category_id: src.category_id,
            brand: src.brand,
            color: src.color,
            size: src.size,
            purchase_price: src.purchase_price,
            selling_price: src.selling_price,
            gst_percent: src.gst_percent,
            discount_percent: src.discount_percent,
            current_stock: item.quantity,
            minimum_stock: src.minimum_stock ?? 0,
            branch_id: data.dest_branch_id,
          }).select("id").single();
        if (insErr) throw new Error(insErr.message);
        destProductId = inserted!.id;
      }

      const { error: decErr } = await supabase
        .from("products")
        .update({ current_stock: (src.current_stock ?? 0) - item.quantity })
        .eq("id", src.id);
      if (decErr) throw new Error(decErr.message);

      results.push({ product_id: src.id, quantity: item.quantity, dest_product_id: destProductId! });
    }

    return { transferred: results.length, items: results };
  });
// ---------- Sales listing / delete ----------

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string | null; to?: string | null; search?: string | null } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("sales")
      .select("id, invoice_number, total, paid, balance, payment_method, status, created_at, branch_id, customer_id, customers(name, phone), branches(name, code)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.search) q = q.ilike("invoice_number", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: sale, error } = await context.supabase
      .from("sales")
      .select("*, customers(name, phone), branches(name, code), sale_items(*)")
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return sale;
  });

export const deleteSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Only admins can archive invoices.");
    // Reverse outstanding debt on customer if the sale had a balance
    const { data: sale } = await supabase.from("sales").select("customer_id, balance").eq("id", data.id).maybeSingle();
    if (sale?.customer_id && Number(sale.balance ?? 0) > 0) {
      const { data: cust } = await supabase.from("customers").select("outstanding_debt").eq("id", sale.customer_id).maybeSingle();
      if (cust) {
        const next = Math.max(0, Number(cust.outstanding_debt ?? 0) - Number(sale.balance));
        await supabase.from("customers").update({ outstanding_debt: next }).eq("id", sale.customer_id);
      }
    }
    const { error } = await supabase.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Customer edit debt / delete ----------

export const updateCustomerDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), outstanding_debt: z.number().min(0) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("customers").update({ outstanding_debt: data.outstanding_debt }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordDebtPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(["cash", "upi", "card"]),
    note: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: cust, error: cErr } = await supabase.from("customers").select("outstanding_debt, name").eq("id", data.id).maybeSingle();
    if (cErr || !cust) throw new Error("Customer not found");
    const current = Number(cust.outstanding_debt ?? 0);
    if (current <= 0) throw new Error("This customer has no outstanding debt.");
    const next = Math.max(0, current - data.amount);
    const { error } = await supabase.from("customers").update({ outstanding_debt: next }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, previous: current, remaining: next, paid: data.amount, method: data.method };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Only admins can archive customers.");
    const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Reports / analytics ----------

export const getReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const to = data.to ? new Date(data.to) : new Date();
    const from = data.from ? new Date(data.from) : new Date(to.getTime() - 30 * 86400000);
    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    const { data: sales } = await context.supabase
      .from("sales")
      .select("id, total, paid, balance, tax, discount, payment_method, created_at, branch_id, branches(name,code), sale_items(product_id, product_name, quantity, line_total)")
      .is("deleted_at", null)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: true });

    const rows = sales ?? [];
    const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + Number(r[k] ?? 0), 0);

    // Daily
    const byDay = new Map<string, { date: string; revenue: number; tax: number; bills: number }>();
    for (const r of rows) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      const b = byDay.get(key) ?? { date: key, revenue: 0, tax: 0, bills: 0 };
      b.revenue += Number(r.total); b.tax += Number(r.tax); b.bills += 1;
      byDay.set(key, b);
    }

    // Payment method breakdown
    const byMethod = new Map<string, number>();
    for (const r of rows) byMethod.set(r.payment_method, (byMethod.get(r.payment_method) ?? 0) + Number(r.total));

    // Branch revenue
    const byBranch = new Map<string, { name: string; revenue: number; bills: number }>();
    for (const r of rows) {
      const key = (r as any).branches?.name ?? "Unassigned";
      const b = byBranch.get(key) ?? { name: key, revenue: 0, bills: 0 };
      b.revenue += Number(r.total); b.bills += 1;
      byBranch.set(key, b);
    }

    // Top products
    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const r of rows) {
      for (const it of (r as any).sale_items ?? []) {
        const p = byProduct.get(it.product_id) ?? { name: it.product_name, qty: 0, revenue: 0 };
        p.qty += Number(it.quantity); p.revenue += Number(it.line_total);
        byProduct.set(it.product_id, p);
      }
    }

    return {
      range: { from: fromISO, to: toISO },
      totals: {
        revenue: sum(rows, "total"),
        collected: sum(rows, "paid"),
        outstanding: sum(rows, "balance"),
        tax: sum(rows, "tax"),
        discount: sum(rows, "discount"),
        bills: rows.length,
      },
      daily: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount })),
      byBranch: Array.from(byBranch.values()).sort((a, b) => b.revenue - a.revenue),
      topProducts: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    };
  });

// ---------- Expenses ----------

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("expenses")
      .select("*, branches(name, code)")
      .order("spent_on", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("spent_on", data.from);
    if (data.to) q = q.lte("spent_on", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    category: z.string().min(1),
    description: z.string().optional().nullable(),
    amount: z.number().positive(),
    spent_on: z.string().min(1),
    branch_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    let branch = data.branch_id ?? null;
    if (!isAdmin) {
      const { data: prof } = await supabase.from("profiles").select("branch_id").eq("id", userId).maybeSingle();
      branch = prof?.branch_id ?? null;
    }
    const { data: row, error } = await supabase.from("expenses").insert({
      category: data.category,
      description: data.description ?? null,
      amount: data.amount,
      spent_on: data.spent_on,
      branch_id: branch,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Only admins can delete expenses.");
    const { error } = await supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getExpenseStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    const startWeek = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const startMonthMinus5 = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

    const { data: rows } = await context.supabase
      .from("expenses").select("amount, category, spent_on, branch_id, branches(name)")
      .gte("spent_on", startMonthMinus5).order("spent_on", { ascending: true });

    const list = rows ?? [];
    const sum = (arr: any[]) => arr.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const today = list.filter((r: any) => r.spent_on >= startToday);
    const week = list.filter((r: any) => r.spent_on >= startWeek);
    const month = list.filter((r: any) => r.spent_on >= startMonth);

    const byCategory = new Map<string, number>();
    for (const r of month) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));

    const byMonth = new Map<string, number>();
    for (const r of list) {
      const key = String(r.spent_on).slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(r.amount));
    }

    const byBranch = new Map<string, number>();
    for (const r of month) {
      const key = (r as any).branches?.name ?? "Unassigned";
      byBranch.set(key, (byBranch.get(key) ?? 0) + Number(r.amount));
    }

    return {
      today: sum(today),
      week: sum(week),
      month: sum(month),
      byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      byMonth: Array.from(byMonth.entries()).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
      byBranch: Array.from(byBranch.entries()).map(([branch, amount]) => ({ branch, amount })),
    };
  });

// ---------- Admin: clear drafts / purge archived ----------

export const purgeArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Admin only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Delete sale_items of archived sales, then archived sales, then archived customers.
    const { data: archivedSales } = await supabaseAdmin.from("sales").select("id").not("deleted_at", "is", null);
    const ids = (archivedSales ?? []).map((s: any) => s.id);
    let items = 0, sales = 0, custs = 0;
    if (ids.length) {
      const r1 = await supabaseAdmin.from("sale_items").delete().in("sale_id", ids).select("id");
      items = r1.data?.length ?? 0;
      const r2 = await supabaseAdmin.from("sales").delete().in("id", ids).select("id");
      sales = r2.data?.length ?? 0;
    }
    const r3 = await supabaseAdmin.from("customers").delete().not("deleted_at", "is", null).select("id");
    custs = r3.data?.length ?? 0;
    return { ok: true, sales, sale_items: items, customers: custs };
  });

export const updateProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), image_url: z.string().url().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("products").update({ image_url: data.image_url }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
