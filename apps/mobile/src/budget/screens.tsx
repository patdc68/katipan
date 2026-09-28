import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import {
  EditorialCard,
  EmptyState,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../ui";
import { weddingDisplayName } from "../workspace/presentation";
import {
  archiveBudgetCategory,
  createBudgetCategory,
  reorderBudgetCategories,
  updateBudgetCategory,
} from "./api";
import {
  budgetDifference,
  budgetProgressPercent,
  formatCurrency,
  isBudgetFinanceManager,
  safeBudgetError,
  SingleSubmitGate,
  type BudgetCategorySummary,
  type BudgetItemStatus,
} from "./model";
import {
  useBudgetCategoriesResource,
  useBudgetCategoryResource,
  useBudgetDashboardResource,
} from "./use-budget-resource";

type Router = ReturnType<typeof useRouter>;

function budgetRoute(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget", params: { weddingId } } as unknown as Href;
}

function categoriesRoute(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget/categories", params: { weddingId } } as unknown as Href;
}

function categoryRoute(weddingId: string, categoryId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/categories/[categoryId]",
    params: { weddingId, categoryId },
  } as unknown as Href;
}

function itemRoute(weddingId: string, itemId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/items/[itemId]",
    params: { weddingId, itemId },
  } as unknown as Href;
}

function newItemRoute(weddingId: string, categoryId?: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/items/new",
    params: { weddingId, ...(categoryId ? { categoryId } : {}) },
  } as unknown as Href;
}

function newExpenseRoute(weddingId: string, categoryId?: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/expenses/new",
    params: { weddingId, ...(categoryId ? { categoryId } : {}) },
  } as unknown as Href;
}

function weddingName(membership: NonNullable<ReturnType<typeof useBudgetDashboardResource>["membership"]>): string {
  return weddingDisplayName(membership.partnerNames, membership.wedding.display_name);
}

function pageUnavailable(router: Router) {
  return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
}

function privateBudgetScreen(router: Router) {
  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <Brand compact />
      <EditorialCard style={styles.privateCard}>
        <KatipanText variant="labelCaps" color="secondary">PRIVATE WEDDING FINANCES</KatipanText>
        <KatipanText variant="headlineMedium" accessibilityRole="header">Budget details are private</KatipanText>
        <KatipanText color="textMuted">Your current Wedding role does not have access to its Budget.</KatipanText>
        <KatipanButton label="Switch Wedding" variant="secondary" onPress={() => router.replace("/(workspace)/weddings")} />
      </EditorialCard>
    </KatipanScreen>
  );
}

function StatusBadge({ status }: { status: BudgetItemStatus }) {
  const tone = status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "error" : "neutral";
  return <StatusChip label={status.replaceAll("_", " ")} tone={tone} />;
}

function MoneyPair({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <View style={styles.moneyPair}>
      <KatipanText variant="labelCaps" color="textMuted">{label}</KatipanText>
      <KatipanText variant="title" style={styles.moneyValue}>{formatCurrency(amount, currency)}</KatipanText>
    </View>
  );
}

function CategoryCard({
  category,
  currency,
  onPress,
}: {
  category: BudgetCategorySummary;
  currency: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${category.name} category`} onPress={onPress}>
      <EditorialCard style={styles.categoryCard}>
        <View style={styles.categoryCardHeading}>
          <KatipanText variant="title" style={styles.categoryName}>{category.name}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{category.activeItemCount} active</KatipanText>
        </View>
        <MoneyPair label="ESTIMATED" amount={category.estimatedTotal} currency={currency} />
        <MoneyPair label="ACTUAL" amount={category.manualActualTotal + category.supplierActualTotal} currency={currency} />
      </EditorialCard>
    </Pressable>
  );
}

function ItemRow({
  name,
  categoryName,
  status,
  estimated,
  actual,
  currency,
  onPress,
  supplierLabel,
}: {
  name: string;
  categoryName: string;
  status: BudgetItemStatus;
  estimated: number;
  actual: number;
  currency: string;
  onPress: () => void;
  supplierLabel?: string | null;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${name}`} onPress={onPress}>
      <EditorialCard style={styles.itemCard}>
        <View style={styles.itemHeading}>
          <View style={styles.itemNameBlock}>
            <KatipanText variant="title">{name}</KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">{categoryName}</KatipanText>
            {supplierLabel && <KatipanText variant="bodySmall" color="secondary">Supplier · {supplierLabel}</KatipanText>}
          </View>
          <StatusBadge status={status} />
        </View>
        <View style={styles.itemMoneyRow}>
          <MoneyPair label="ESTIMATED" amount={estimated} currency={currency} />
          <MoneyPair label="ACTUAL" amount={actual} currency={currency} />
        </View>
      </EditorialCard>
    </Pressable>
  );
}

export function BudgetDashboardScreen() {
  const router = useRouter();
  const resource = useBudgetDashboardResource();
  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label="Loading Wedding Budget…" /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) return pageUnavailable(router);
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Budget unavailable" description="We couldn't load this Wedding's Budget." onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private") return privateBudgetScreen(router);
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Budget unavailable" /></KatipanScreen>;

  const { totals, categories, recentItems } = resource.data.data;
  const difference = budgetDifference(totals.estimatedTotal, totals.actualTotal);
  const progress = budgetProgressPercent(totals.estimatedTotal, totals.actualTotal);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const canEdit = isBudgetFinanceManager(resource.membership);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}><Brand compact /><KatipanText variant="labelCaps" color="secondary">WEDDING FINANCES</KatipanText></View>
        <StatusChip label={resource.membership.role.replaceAll("_", " ")} tone="success" />
      </View>
      <View style={styles.titleBlock}>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Wedding Budget</KatipanText>
        <KatipanText color="textMuted">{weddingName(resource.membership)}</KatipanText>
      </View>

      <EditorialCard style={styles.overviewCard}>
        <KatipanText variant="labelCaps" color="secondary">BUDGET OVERVIEW</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">WEDDING CURRENCY · {totals.currencyCode}</KatipanText>
        <View style={styles.overviewTotal}>
          <KatipanText variant="bodySmall" color="textMuted">ESTIMATED BUDGET</KatipanText>
          <KatipanText variant="headlineLarge" style={styles.heroAmount}>{formatCurrency(totals.estimatedTotal, totals.currencyCode)}</KatipanText>
        </View>
        <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel={`${Math.round(progress)} percent of estimated budget recorded as actual spend`}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.summaryGrid}>
          <MoneyPair label="ACTUAL SPEND" amount={totals.actualTotal} currency={totals.currencyCode} />
          {difference.label === "no estimate"
            ? <View style={styles.moneyPair}><KatipanText variant="labelCaps" color="textMuted">BUDGET DIFFERENCE</KatipanText><KatipanText variant="bodySmall" color="textMuted">No estimate yet</KatipanText></View>
            : <MoneyPair label={difference.label === "over budget" ? "OVER BUDGET" : "REMAINING"} amount={difference.amount} currency={totals.currencyCode} />}
          <MoneyPair label="MANUAL ACTUAL" amount={totals.manualActualTotal} currency={totals.currencyCode} />
          <MoneyPair label="SUPPLIER ACTUAL" amount={totals.supplierActualTotal} currency={totals.currencyCode} />
        </View>
        {totals.estimatedTotal === 0 && <KatipanText variant="bodySmall" color="textMuted">No estimated Budget has been added yet.</KatipanText>}
        {totals.actualTotal === 0 && <KatipanText variant="bodySmall" color="textMuted">No actual spending has been recorded yet.</KatipanText>}
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader
          title="Budget Categories"
          eyebrow="PLAN BY CATEGORY"
          action={<KatipanButton label="View all" variant="text" onPress={() => router.push(categoriesRoute(resource.weddingId))} />}
        />
        {categories.length === 0 ? (
          <EmptyState
            title="No Budget Categories yet"
            description="Add a category to begin organizing your wedding Budget."
            action={<KatipanButton label="Create Categories" onPress={() => router.push(categoriesRoute(resource.weddingId))} />}
          />
        ) : categories.slice(0, 4).map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            currency={totals.currencyCode}
            onPress={() => router.push(categoryRoute(resource.weddingId, category.id))}
          />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Budget Items" eyebrow="RECENTLY UPDATED" description="Planned amounts and actual costs in one place." />
        {recentItems.length === 0 ? (
          <EmptyState title="No active Budget Items" description="Your planned allocations will appear here." />
        ) : recentItems.map((item) => (
          <ItemRow
            key={item.id}
            name={item.name}
            categoryName={categoryNames.get(item.category_id) ?? "Budget Category"}
            status={item.status}
            estimated={item.estimated_amount}
            actual={item.actualTotal}
            currency={totals.currencyCode}
            onPress={() => router.push(itemRoute(resource.weddingId, item.id))}
          />
        ))}
      </View>

      {canEdit && <View style={styles.actionStack}>
        <KatipanButton label="Add Budget Item" onPress={() => router.push(newItemRoute(resource.weddingId))} />
        <KatipanButton label="Add Manual Expense" variant="secondary" onPress={() => router.push(newExpenseRoute(resource.weddingId))} />
      </View>}
    </KatipanScreen>
  );
}

export function BudgetCategoriesScreen() {
  const router = useRouter();
  const resource = useBudgetCategoriesResource();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());

  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label="Loading Budget Categories…" /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) return pageUnavailable(router);
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Budget Categories unavailable" onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private") return privateBudgetScreen(router);
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Budget Categories unavailable" /></KatipanScreen>;

  const { categories, totals } = resource.data.data;
  const canEdit = isBudgetFinanceManager(resource.membership);
  const runAction = async (action: () => Promise<void>) => gate.current.run(async () => {
    setSaving(true);
    setActionError(null);
    try { await action(); }
    catch (error) { setActionError(safeBudgetError(error)); }
    finally { setSaving(false); }
  });

  const createCategory = async () => {
    if (!name.trim()) { setActionError("Enter a category name."); return; }
    await runAction(async () => {
      const sortOrder = categories.length ? Math.max(...categories.map((category) => category.sort_order)) + 10 : 0;
      await createBudgetCategory(resource.membership!, { name, description: description || null, sortOrder });
      setName("");
      setDescription("");
      resource.retry();
    });
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const next = [...categories];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    await runAction(async () => {
      await reorderBudgetCategories(resource.membership!, next.map((category) => category.id));
      resource.retry();
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Budget" variant="text" onPress={() => router.replace(budgetRoute(resource.weddingId))} />
      <View style={styles.titleBlock}>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Budget Categories</KatipanText>
        <KatipanText color="textMuted">Organize the planned and actual costs for {weddingName(resource.membership)}.</KatipanText>
      </View>

      {canEdit && <EditorialCard style={styles.formCard}>
        <KatipanText variant="labelCaps" color="secondary">NEW CATEGORY</KatipanText>
        <FormField label="Category name" value={name} onChangeText={setName} editable={!saving} placeholder="e.g. Ceremony" />
        <FormField label="Description" value={description} onChangeText={setDescription} editable={!saving} placeholder="Optional" multiline />
        {actionError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
        <KatipanButton label="Add Category" loading={saving} onPress={() => void createCategory()} />
      </EditorialCard>}

      <View style={styles.section}>
        <SectionHeader title="Active Categories" eyebrow={`${categories.length} CATEGORIES`} description={`Amounts shown in ${totals.currencyCode}. Archived categories stay attached to their Budget Items.`} />
        {categories.length === 0 ? (
          <EmptyState title="No Budget Categories" description="Create your first category above. No sample categories are added for you." />
        ) : categories.map((category, index) => (
          <View key={category.id} style={styles.categoryLine}>
            <CategoryCard
              category={category}
              currency={totals.currencyCode}
              onPress={() => router.push(categoryRoute(resource.weddingId, category.id))}
            />
            {canEdit && <View style={styles.reorderRow}>
              <KatipanButton label="Move Up ↑" variant="text" disabled={saving || index === 0} onPress={() => void moveCategory(index, -1)} />
              <KatipanButton label="Move Down ↓" variant="text" disabled={saving || index === categories.length - 1} onPress={() => void moveCategory(index, 1)} />
            </View>}
          </View>
        ))}
        {categories.length > 0 && actionError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
      </View>
    </KatipanScreen>
  );
}

export function BudgetCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string | string[] }>();
  const categoryId = Array.isArray(params.categoryId) ? params.categoryId[0] ?? "" : params.categoryId ?? "";
  const resource = useBudgetCategoryResource(categoryId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());

  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label="Loading category details…" /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) return pageUnavailable(router);
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Category details unavailable" description="We couldn't load this Wedding category." onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private") return privateBudgetScreen(router);
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Category unavailable in this Wedding" onRetry={() => router.replace(categoriesRoute(resource.weddingId))} /></KatipanScreen>;

  const { category, items, totals } = resource.data.data;
  const canEdit = isBudgetFinanceManager(resource.membership);
  const activeItems = items.filter((item) => item.status === "PLANNED" || item.status === "CONFIRMED");
  const historyItems = items.filter((item) => item.status === "CANCELLED" || item.status === "ARCHIVED");
  const runAction = async (action: () => Promise<void>) => gate.current.run(async () => {
    setSaving(true);
    setActionError(null);
    try { await action(); }
    catch (error) { setActionError(safeBudgetError(error)); }
    finally { setSaving(false); }
  });

  const saveCategory = async () => {
    if (!name.trim()) { setActionError("Enter a category name."); return; }
    await runAction(async () => {
      await updateBudgetCategory(resource.membership!, category.id, { name, description: description || null });
      setEditing(false);
      resource.retry();
    });
  };

  const doArchive = async () => runAction(async () => {
    await archiveBudgetCategory(resource.membership!, category.id);
    router.replace(categoriesRoute(resource.weddingId));
  });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Categories" variant="text" onPress={() => router.replace(categoriesRoute(resource.weddingId))} />
      <View style={styles.titleBlock}>
        <View style={styles.titleAndBadge}>
          <KatipanText variant="headlineLarge" accessibilityRole="header">{category.name}</KatipanText>
          {category.archived_at && <StatusChip label="Archived" tone="neutral" />}
        </View>
        <KatipanText color="textMuted">{category.description || "A clear place to plan and review related costs."}</KatipanText>
      </View>

      {editing && canEdit && <EditorialCard style={styles.formCard}>
        <KatipanText variant="labelCaps" color="secondary">EDIT CATEGORY</KatipanText>
        <FormField label="Category name" value={name} onChangeText={setName} editable={!saving} />
        <FormField label="Description" value={description} onChangeText={setDescription} editable={!saving} multiline />
        {actionError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
        <KatipanButton label="Save Category" loading={saving} onPress={() => void saveCategory()} />
        <KatipanButton label="Cancel" variant="secondary" disabled={saving} onPress={() => { setEditing(false); setName(category.name); setDescription(category.description ?? ""); }} />
      </EditorialCard>}

      <EditorialCard style={styles.categoryTotalsCard}>
        <KatipanText variant="labelCaps" color="secondary">CATEGORY TOTALS · {totals.currencyCode}</KatipanText>
        <MoneyPair label="ESTIMATED · ACTIVE ITEMS" amount={category.estimatedTotal} currency={totals.currencyCode} />
        <MoneyPair label="MANUAL ACTUAL" amount={category.manualActualTotal} currency={totals.currencyCode} />
        <MoneyPair label="SUPPLIER ACTUAL · LINKED ITEMS" amount={category.supplierActualTotal} currency={totals.currencyCode} />
        <KatipanText variant="bodySmall" color="textMuted">Supplier actual is included only when a payment transaction is linked to a Budget Item in this category.</KatipanText>
      </EditorialCard>

      {canEdit && <View style={styles.actionStack}>
        {category.archived_at === null && <>
          <KatipanButton label="Add Budget Item" onPress={() => router.push(newItemRoute(resource.weddingId, category.id))} />
          <KatipanButton label="Add Manual Expense" variant="secondary" onPress={() => router.push(newExpenseRoute(resource.weddingId, category.id))} />
        </>}
        <KatipanButton label="Edit Category" variant="text" disabled={saving} onPress={() => {
          if (!editing) { setName(category.name); setDescription(category.description ?? ""); }
          setEditing((value) => !value);
          setActionError(null);
        }} />
        {category.archived_at === null && !confirmArchive && <KatipanButton label="Archive Category" variant="text" disabled={saving} onPress={() => setConfirmArchive(true)} />}
      </View>}

      {confirmArchive && <EditorialCard style={styles.archiveCard}>
        <KatipanText variant="title">Archive this category?</KatipanText>
        <KatipanText color="textMuted">It will leave active category lists. Its Budget Items and finance history remain in this Wedding.</KatipanText>
        {actionError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
        <KatipanButton label="Confirm Archive" loading={saving} onPress={() => void doArchive()} />
        <KatipanButton label="Keep Category Active" variant="secondary" disabled={saving} onPress={() => { setConfirmArchive(false); setActionError(null); }} />
      </EditorialCard>}

      <View style={styles.section}>
        <SectionHeader title="Budget Items" eyebrow={`${items.length} ITEMS`} description="Estimated allocation and actual spend remain separate." />
        {activeItems.length === 0 && <EmptyState title="No active Budget Items" description={items.length ? "Only cancelled or archived items remain in this category." : "Add an item or record a manual expense to begin."} />}
        {activeItems.map((item) => <ItemRow
          key={item.id}
          name={item.name}
          categoryName={category.name}
          supplierLabel={item.supplierLabel}
          status={item.status}
          estimated={item.estimated_amount}
          actual={item.actualTotal}
          currency={totals.currencyCode}
          onPress={() => router.push(itemRoute(resource.weddingId, item.id))}
        />)}
        {historyItems.length > 0 && <>
          <SectionHeader title="History" eyebrow="CANCELLED & ARCHIVED" />
          {historyItems.map((item) => <ItemRow
            key={item.id}
            name={item.name}
            categoryName={category.name}
            supplierLabel={item.supplierLabel}
            status={item.status}
            estimated={item.estimated_amount}
            actual={item.actualTotal}
            currency={totals.currencyCode}
            onPress={() => router.push(itemRoute(resource.weddingId, item.id))}
          />)}
        </>}
      </View>
      {actionError && !confirmArchive && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  brandCopy: { gap: s.small },
  titleBlock: { gap: s.small },
  titleAndBadge: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: s.small },
  privateCard: { gap: s.medium },
  overviewCard: { gap: s.medium, padding: s.cardLarge },
  overviewTotal: { gap: s.small },
  heroAmount: { color: c.espresso },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: r.pill, backgroundColor: c.softBeige },
  progressFill: { height: "100%", borderRadius: r.pill, backgroundColor: c.sageRomance },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: s.medium },
  moneyPair: { flex: 1, minWidth: 132, gap: s.micro },
  moneyValue: { fontVariant: ["tabular-nums"] },
  section: { gap: s.medium },
  categoryCard: { gap: s.medium },
  categoryCardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  categoryName: { flex: 1 },
  itemCard: { gap: s.medium },
  itemHeading: { flexDirection: "row", alignItems: "flex-start", gap: s.small },
  itemNameBlock: { flex: 1, gap: s.micro },
  itemMoneyRow: { flexDirection: "row", gap: s.medium },
  actionStack: { gap: s.small },
  formCard: { gap: s.medium },
  categoryLine: { gap: s.micro },
  reorderRow: { flexDirection: "row", justifyContent: "flex-end", gap: s.small },
  categoryTotalsCard: { gap: s.medium },
  archiveCard: { gap: s.medium, borderColor: c.antiqueGold },
});
