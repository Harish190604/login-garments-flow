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
});

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productInput.parse(d))
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
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const payload = { ...data, email: data.email || null };
    const { error, data: row } = await context.supabase.from("customers").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
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
      branch_id: data.branch_id ?? null,
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