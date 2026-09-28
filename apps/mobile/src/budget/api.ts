import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  deriveBudgetItemSummary,
  deriveCategorySummaries,
  deriveSupplierActualByItem,
  isBudgetFinanceManager,
  type BudgetCategory,
  type BudgetCategoryData,
  type BudgetDashboardData,
  type BudgetEditorData,
  type BudgetItem,
  type BudgetItemWrite,
  type BudgetLoadResult,
  type BudgetTotals,
  type SupplierActualTransaction,
} from "./model";

function permissionError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42501");
}

function assertActiveMembership(membership: WorkspaceMembership): void {
  if (membership.status !== "ACTIVE") throw new Error("An active Wedding membership is required.");
}

async function readCanonicalTotals(
  membership: WorkspaceMembership,
): Promise<BudgetLoadResult<BudgetTotals>> {
  assertActiveMembership(membership);
  if (!isBudgetFinanceManager(membership)) return { kind: "private" };

  const { data, error } = await supabase
    .from("wedding_budget_totals")
    .select("wedding_id,currency_code,active_item_count,estimated_total,actual_total,manual_actual_total,supplier_actual_total")
    .eq("wedding_id", membership.weddingId)
    .maybeSingle();

  if (permissionError(error) || (!error && !data)) return { kind: "private" };
  if (error) throw error;
  if (!data) return { kind: "private" };

  return {
    kind: "ready",
    data: {
      weddingId: data.wedding_id ?? membership.weddingId,
      currencyCode: data.currency_code ?? "PHP",
      activeItemCount: Number(data.active_item_count ?? 0),
      estimatedTotal: Number(data.estimated_total ?? 0),
      actualTotal: Number(data.actual_total ?? 0),
      manualActualTotal: Number(data.manual_actual_total ?? 0),
      supplierActualTotal: Number(data.supplier_actual_total ?? 0),
    },
  };
}

type CategorySources = {
  categories: BudgetCategory[];
  items: BudgetItem[];
  transactions: SupplierActualTransaction[];
};

async function readActiveCategorySources(
  membership: WorkspaceMembership,
): Promise<BudgetLoadResult<CategorySources>> {
  const categoriesResult = await supabase
    .from("budget_categories")
    .select("id,wedding_id,name,description,sort_order,archived_at")
    .eq("wedding_id", membership.weddingId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (permissionError(categoriesResult.error)) return { kind: "private" };
  if (categoriesResult.error) throw categoriesResult.error;
  const categories = categoriesResult.data ?? [];
  const categoryIds = categories.map((category) => category.id);
  if (categoryIds.length === 0) return { kind: "ready", data: { categories, items: [], transactions: [] } };

  const itemsResult = await supabase
    .from("budget_items")
    .select("id,wedding_id,category_id,supplier_id,name,description,estimated_amount,actual_amount,notes,status,updated_at")
    .eq("wedding_id", membership.weddingId)
    .in("category_id", categoryIds)
    .order("updated_at", { ascending: false });

  if (permissionError(itemsResult.error)) return { kind: "private" };
  if (itemsResult.error) throw itemsResult.error;
  const items = itemsResult.data ?? [];
  const supplierItemIds = items.filter((item) => item.supplier_id !== null).map((item) => item.id);
  if (supplierItemIds.length === 0) {
    return { kind: "ready", data: { categories, items, transactions: [] } };
  }

  const transactionsResult = await supabase
    .from("supplier_payment_transactions")
    .select("budget_item_id,kind,amount")
    .eq("wedding_id", membership.weddingId)
    .in("budget_item_id", supplierItemIds);

  if (permissionError(transactionsResult.error)) return { kind: "private" };
  if (transactionsResult.error) throw transactionsResult.error;
  return {
    kind: "ready",
    data: { categories, items, transactions: transactionsResult.data ?? [] },
  };
}

export async function loadBudgetDashboard(
  membership: WorkspaceMembership,
): Promise<BudgetLoadResult<BudgetDashboardData>> {
  const totalsResult = await readCanonicalTotals(membership);
  if (totalsResult.kind !== "ready") return totalsResult;
  const sourcesResult = await readActiveCategorySources(membership);
  if (sourcesResult.kind !== "ready") return sourcesResult;
  const { categories, items, transactions } = sourcesResult.data;
  const supplierActualByItem = deriveSupplierActualByItem(transactions);

  const recentResult = categories.length
    ? await supabase
      .from("budget_items")
      .select("id,wedding_id,category_id,supplier_id,name,description,estimated_amount,actual_amount,notes,status,updated_at")
      .eq("wedding_id", membership.weddingId)
      .in("category_id", categories.map((category) => category.id))
      .in("status", ["PLANNED", "CONFIRMED"])
      .order("updated_at", { ascending: false })
      .limit(5)
    : { data: [], error: null };

  if (permissionError(recentResult.error)) return { kind: "private" };
  if (recentResult.error) throw recentResult.error;

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const summaries = deriveCategorySummaries(categories, items, transactions);
  const recentItems = (recentResult.data ?? []).map((item) => deriveBudgetItemSummary(
    item,
    supplierActualByItem.get(item.id) ?? 0,
    null,
  ));

  return {
    kind: "ready",
    data: {
      totals: totalsResult.data,
      categories: summaries,
      recentItems: recentItems.filter((item) => categoryNames.has(item.category_id)),
    },
  };
}

export async function loadBudgetCategories(
  membership: WorkspaceMembership,
): Promise<BudgetLoadResult<{ totals: BudgetTotals; categories: ReturnType<typeof deriveCategorySummaries> }>> {
  const totalsResult = await readCanonicalTotals(membership);
  if (totalsResult.kind !== "ready") return totalsResult;
  const sourcesResult = await readActiveCategorySources(membership);
  if (sourcesResult.kind !== "ready") return sourcesResult;
  return {
    kind: "ready",
    data: {
      totals: totalsResult.data,
      categories: deriveCategorySummaries(
        sourcesResult.data.categories,
        sourcesResult.data.items,
        sourcesResult.data.transactions,
      ),
    },
  };
}

export async function loadBudgetCategory(
  membership: WorkspaceMembership,
  categoryId: string,
): Promise<BudgetLoadResult<BudgetCategoryData>> {
  const totalsResult = await readCanonicalTotals(membership);
  if (totalsResult.kind !== "ready") return totalsResult;

  const categoryResult = await supabase
    .from("budget_categories")
    .select("id,wedding_id,name,description,sort_order,archived_at")
    .eq("wedding_id", membership.weddingId)
    .eq("id", categoryId)
    .maybeSingle();
  if (permissionError(categoryResult.error)) return { kind: "private" };
  if (categoryResult.error) throw categoryResult.error;
  if (!categoryResult.data) return { kind: "unavailable" };

  const itemsResult = await supabase
    .from("budget_items")
    .select("id,wedding_id,category_id,supplier_id,name,description,estimated_amount,actual_amount,notes,status,updated_at")
    .eq("wedding_id", membership.weddingId)
    .eq("category_id", categoryId)
    .order("updated_at", { ascending: false });
  if (permissionError(itemsResult.error)) return { kind: "private" };
  if (itemsResult.error) throw itemsResult.error;
  const items = itemsResult.data ?? [];
  const supplierItemIds = items.filter((item) => item.supplier_id !== null).map((item) => item.id);

  const [transactionsResult, suppliersResult] = await Promise.all([
    supplierItemIds.length
      ? supabase
        .from("supplier_payment_transactions")
        .select("budget_item_id,kind,amount")
        .eq("wedding_id", membership.weddingId)
        .in("budget_item_id", supplierItemIds)
      : Promise.resolve({ data: [], error: null }),
    items.some((item) => item.supplier_id !== null)
      ? supabase
        .from("suppliers")
        .select("id,wedding_id,name,category")
        .eq("wedding_id", membership.weddingId)
        .in("id", [...new Set(items.flatMap((item) => item.supplier_id ? [item.supplier_id] : []))])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (permissionError(transactionsResult.error) || permissionError(suppliersResult.error)) return { kind: "private" };
  if (transactionsResult.error) throw transactionsResult.error;
  if (suppliersResult.error) throw suppliersResult.error;

  const transactions = transactionsResult.data ?? [];
  const supplierActualByItem = deriveSupplierActualByItem(transactions);
  const supplierById = new Map((suppliersResult.data ?? []).map((supplier) => [supplier.id, supplier]));
  const supplierLabels = new Map<string, string>(
    (suppliersResult.data ?? []).map((supplier) => [supplier.id, `${supplier.name} · ${supplier.category}`]),
  );
  const category = categoryResult.data;
  const summary = deriveCategorySummaries([category], items, transactions)[0];
  if (!summary) return { kind: "unavailable" };

  return {
    kind: "ready",
    data: {
      totals: totalsResult.data,
      category: summary,
      items: items.map((item) => {
        const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
        return deriveBudgetItemSummary(
          item,
          supplierActualByItem.get(item.id) ?? 0,
          supplier ? supplierLabels.get(supplier.id) ?? supplier.name : null,
        );
      }),
    },
  };
}

export async function loadBudgetItemEditor(
  membership: WorkspaceMembership,
  itemId: string | null,
): Promise<BudgetLoadResult<BudgetEditorData>> {
  const totalsResult = await readCanonicalTotals(membership);
  if (totalsResult.kind !== "ready") return totalsResult;

  const [categoriesResult, suppliersResult, itemResult] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("id,wedding_id,name,description,sort_order,archived_at")
      .eq("wedding_id", membership.weddingId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id,wedding_id,name,category")
      .eq("wedding_id", membership.weddingId)
      .order("name", { ascending: true }),
    itemId
      ? supabase
        .from("budget_items")
        .select("id,wedding_id,category_id,supplier_id,name,description,estimated_amount,actual_amount,notes,status,updated_at")
        .eq("wedding_id", membership.weddingId)
        .eq("id", itemId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if ([categoriesResult.error, suppliersResult.error, itemResult.error].some(permissionError)) {
    return { kind: "private" };
  }
  if (categoriesResult.error) throw categoriesResult.error;
  if (suppliersResult.error) throw suppliersResult.error;
  if (itemResult.error) throw itemResult.error;
  if (itemId && !itemResult.data) return { kind: "unavailable" };

  return {
    kind: "ready",
    data: {
      totals: totalsResult.data,
      categories: categoriesResult.data ?? [],
      suppliers: suppliersResult.data ?? [],
      item: itemResult.data,
    },
  };
}

function requireFinanceWrite(membership: WorkspaceMembership): void {
  assertActiveMembership(membership);
  if (!isBudgetFinanceManager(membership)) {
    throw Object.assign(new Error("Budget management is not permitted."), { code: "42501" });
  }
}

export async function createBudgetCategory(
  membership: WorkspaceMembership,
  input: { name: string; description: string | null; sortOrder: number },
): Promise<string> {
  requireFinanceWrite(membership);
  const { data, error } = await supabase
    .from("budget_categories")
    .insert({
      wedding_id: membership.weddingId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateBudgetCategory(
  membership: WorkspaceMembership,
  categoryId: string,
  input: { name: string; description: string | null },
): Promise<void> {
  requireFinanceWrite(membership);
  const { data, error } = await supabase
    .from("budget_categories")
    .update({ name: input.name.trim(), description: input.description?.trim() || null })
    .eq("wedding_id", membership.weddingId)
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This category is unavailable in this Wedding.");
}

export async function archiveBudgetCategory(
  membership: WorkspaceMembership,
  categoryId: string,
  archivedAt = new Date().toISOString(),
): Promise<void> {
  requireFinanceWrite(membership);
  const { data, error } = await supabase
    .from("budget_categories")
    .update({ archived_at: archivedAt })
    .eq("wedding_id", membership.weddingId)
    .eq("id", categoryId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This category is unavailable in this Wedding.");
}

export async function reorderBudgetCategories(
  membership: WorkspaceMembership,
  categoryIds: readonly string[],
): Promise<void> {
  requireFinanceWrite(membership);
  for (const [index, categoryId] of categoryIds.entries()) {
    const { data, error } = await supabase
      .from("budget_categories")
      .update({ sort_order: index * 10 })
      .eq("wedding_id", membership.weddingId)
      .eq("id", categoryId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("A category in this order is unavailable in this Wedding.");
  }
}

async function requireCategoryInWedding(membership: WorkspaceMembership, categoryId: string): Promise<void> {
  const { data, error } = await supabase
    .from("budget_categories")
    .select("id")
    .eq("wedding_id", membership.weddingId)
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Choose a Budget Category from this Wedding.");
}

async function requireSupplierInWedding(
  membership: WorkspaceMembership,
  supplierId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("wedding_id", membership.weddingId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Choose a Supplier from this Wedding.");
}

export async function saveBudgetItem(
  membership: WorkspaceMembership,
  itemId: string | null,
  input: BudgetItemWrite,
): Promise<string> {
  requireFinanceWrite(membership);

  if (itemId) {
    const { data, error } = await supabase
      .from("budget_items")
      .select("id")
      .eq("wedding_id", membership.weddingId)
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This Budget Item is unavailable in this Wedding.");
  }

  await requireCategoryInWedding(membership, input.categoryId);
  if (input.supplierId) await requireSupplierInWedding(membership, input.supplierId);

  // PostgreSQL accepts NULL for these nullable UUID/numeric/text function inputs.
  // Supabase's generated RPC argument type currently describes them as non-null.
  const nullableSupplierId = input.supplierId as string;
  const nullableActualAmount = input.actualAmount as number;
  const nullableDescription = input.description as string;
  const nullableNotes = input.notes as string;

  if (itemId) {
    const { data, error } = await supabase.rpc("update_budget_item", {
      p_budget_item_id: itemId,
      p_category_id: input.categoryId,
      p_supplier_id: nullableSupplierId,
      p_name: input.name,
      p_description: nullableDescription,
      p_estimated_amount: input.estimatedAmount,
      p_actual_amount: nullableActualAmount,
      p_notes: nullableNotes,
      p_status: input.status,
    });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.rpc("create_budget_item", {
    p_wedding_id: membership.weddingId,
    p_category_id: input.categoryId,
    p_supplier_id: nullableSupplierId,
    p_name: input.name,
    p_description: input.description ?? undefined,
    p_estimated_amount: input.estimatedAmount,
    p_actual_amount: input.actualAmount ?? undefined,
    p_notes: input.notes ?? undefined,
    p_status: input.status,
  });
  if (error) throw error;
  return data;
}
