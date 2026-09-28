import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { Brand } from "../onboarding/components";
import {
  EditorialCard,
  ErrorState,
  FormField,
  KatipanButton,
  KatipanScreen,
  KatipanText,
  LoadingState,
  SectionHeader,
} from "../ui";
import { saveBudgetItem } from "./api";
import {
  BUDGET_ITEM_STATUSES,
  formatCurrency,
  isBudgetFinanceManager,
  parseAmount,
  safeBudgetError,
  SingleSubmitGate,
  validateBudgetItemDraft,
  type BudgetCategory,
  type BudgetItem,
  type BudgetItemDraft,
} from "./model";
import { useBudgetEditorResource } from "./use-budget-resource";

function categoryHref(weddingId: string, categoryId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/categories/[categoryId]",
    params: { weddingId, categoryId },
  } as unknown as Href;
}

function categoriesHref(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget/categories", params: { weddingId } } as unknown as Href;
}

function supplierHref(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function textAmount(amount: number | null): string {
  return amount === null ? "" : String(amount);
}

function initialDraft(
  item: BudgetItem | null,
  categories: readonly BudgetCategory[],
  categoryId: string,
  expenseMode: boolean,
): BudgetItemDraft {
  const activeCategory = categories.find((category) => category.id === categoryId && category.archived_at === null)
    ?? categories.find((category) => category.archived_at === null);
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    categoryId: item?.category_id ?? activeCategory?.id ?? "",
    supplierId: expenseMode ? null : item?.supplier_id ?? null,
    estimatedAmount: expenseMode ? "0" : textAmount(item?.estimated_amount ?? 0),
    actualAmount: expenseMode ? "" : textAmount(item?.actual_amount ?? null),
    notes: item?.notes ?? "",
    status: expenseMode ? "CONFIRMED" : item?.status ?? "PLANNED",
  };
}

export function BudgetItemEditorScreen({ expenseMode = false }: { expenseMode?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemId?: string | string[];
    categoryId?: string | string[];
  }>();
  const itemId = expenseMode ? null : Array.isArray(params.itemId) ? params.itemId[0] ?? null : params.itemId ?? null;
  const categoryId = Array.isArray(params.categoryId) ? params.categoryId[0] ?? "" : params.categoryId ?? "";
  const resource = useBudgetEditorResource(itemId);
  const [draft, setDraft] = useState<BudgetItemDraft>({
    name: "", description: "", categoryId, supplierId: null,
    estimatedAmount: expenseMode ? "0" : "", actualAmount: "", notes: "",
    status: expenseMode ? "CONFIRMED" : "PLANNED",
  });
  const [supplierSearch, setSupplierSearch] = useState("");
  const [fieldError, setFieldError] = useState<Partial<Record<keyof BudgetItemDraft, string>>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gate = useRef(new SingleSubmitGate());
  const initializedKey = useRef<string | null>(null);
  const formKey = `${resource.membership?.membershipId ?? "no-membership"}:${resource.weddingId}:${itemId ?? "new"}:${expenseMode ? "expense" : "item"}`;

  useEffect(() => {
    if (resource.data?.kind !== "ready" || initializedKey.current === formKey) return;
    setDraft(initialDraft(resource.data.data.item, resource.data.data.categories, categoryId, expenseMode));
    initializedKey.current = formKey;
  }, [categoryId, expenseMode, formKey, resource.data]);

  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label={expenseMode ? "Preparing manual expense…" : "Loading Budget Item…"} /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Budget form unavailable" onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private") {
    return <KatipanScreen><EditorialCard style={styles.infoCard}><KatipanText variant="headlineMedium">Budget details are private</KatipanText><KatipanText color="textMuted">Your current Wedding role does not have access to its Budget.</KatipanText></EditorialCard></KatipanScreen>;
  }
  if (resource.data.kind === "unavailable") {
    return <KatipanScreen><ErrorState title="Budget Item unavailable in this Wedding" onRetry={() => router.replace(categoriesHref(resource.weddingId))} /></KatipanScreen>;
  }

  const { item, categories, suppliers, totals } = resource.data.data;
  const canEdit = isBudgetFinanceManager(resource.membership);
  const activeCategories = categories.filter((category) => category.archived_at === null);
  const categoryOptions = item && !activeCategories.some((category) => category.id === item.category_id)
    ? [...categories.filter((category) => category.id === item.category_id), ...activeCategories]
    : activeCategories;
  const selectedSupplier = suppliers.find((supplier) => supplier.id === draft.supplierId) ?? null;
  const matchingSuppliers = suppliers.filter((supplier) => (
    `${supplier.name} ${supplier.category}`.toLocaleLowerCase().includes(supplierSearch.trim().toLocaleLowerCase())
  )).slice(0, 6);
  const allowedCategoryIds = new Set(categoryOptions.map((category) => category.id));
  const allowedSupplierIds = new Set(suppliers.map((supplier) => supplier.id));
  const updateDraft = <K extends keyof BudgetItemDraft>(key: K, value: BudgetItemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldError((current) => ({ ...current, [key]: undefined }));
    setActionError(null);
  };

  const goBack = () => {
    if (draft.categoryId) router.replace(categoryHref(resource.weddingId, draft.categoryId));
    else router.replace({ pathname: "/(wedding)/[weddingId]/budget", params: { weddingId: resource.weddingId } } as unknown as Href);
  };

  const save = async () => {
    if (!canEdit) { setActionError("Budget details are private for this Wedding role."); return; }
    const effectiveDraft: BudgetItemDraft = expenseMode
      ? { ...draft, supplierId: null, estimatedAmount: "0", status: "CONFIRMED" }
      : draft;
    const validation = validateBudgetItemDraft(effectiveDraft, allowedCategoryIds, allowedSupplierIds);
    if (!validation.ok) {
      setFieldError((current) => ({ ...current, [validation.field]: validation.message }));
      return;
    }
    if (expenseMode && parseAmount(effectiveDraft.actualAmount) === null) {
      setFieldError((current) => ({ ...current, actualAmount: "Enter the manual expense amount." }));
      return;
    }

    await gate.current.run(async () => {
      setSaving(true);
      setActionError(null);
      try {
        await saveBudgetItem(resource.membership!, item?.id ?? null, validation.value);
        router.replace(categoryHref(resource.weddingId, validation.value.categoryId));
        initializedKey.current = null;
      } catch (error) {
        setActionError(safeBudgetError(error));
      } finally {
        setSaving(false);
      }
    });
  };

  const availableTitle = expenseMode ? "Add Manual Expense" : item ? "Edit Budget Item" : "Add Budget Item";
  const amountHint = expenseMode
    ? "This is saved as the non-Supplier Budget Item's manual actual amount."
    : "Enter zero if no estimate has been set yet.";

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Category" variant="text" onPress={goBack} />
      <View style={styles.titleBlock}>
        <Brand compact />
        <KatipanText variant="headlineLarge" accessibilityRole="header">{availableTitle}</KatipanText>
        <KatipanText color="textMuted">{expenseMode ? "Record an actual cost in a Budget Category." : "Keep the planned allocation separate from actual spend."}</KatipanText>
      </View>

      {expenseMode && <EditorialCard style={styles.infoCard}>
        <KatipanText variant="labelCaps" color="secondary">MANUAL EXPENSE</KatipanText>
        <KatipanText color="textMuted">This creates a confirmed, non-Supplier Budget Item with a zero estimate and the amount below as its actual expense.</KatipanText>
        <KatipanText variant="bodySmall" color="textMuted">Supplier payment dates, methods, commitments, installments, and receipts are managed separately.</KatipanText>
      </EditorialCard>}

      {activeCategories.length === 0 && <EditorialCard style={styles.infoCard}>
        <KatipanText variant="title">Create an active category first</KatipanText>
        <KatipanText color="textMuted">Budget Items need a category from this Wedding.</KatipanText>
        <KatipanButton label="Open Budget Categories" variant="secondary" onPress={() => router.push(categoriesHref(resource.weddingId))} />
      </EditorialCard>}

      <EditorialCard style={styles.formCard}>
        <SectionHeader title={expenseMode ? "Expense details" : "Budget Item details"} eyebrow={expenseMode ? "ACTUAL COST" : "BUDGET ALLOCATION"} />
        <FormField label={expenseMode ? "Expense name" : "Budget Item name"} value={draft.name} onChangeText={(value) => updateDraft("name", value)} editable={!saving} error={fieldError.name} placeholder={expenseMode ? "e.g. Ceremony permits" : "e.g. Ceremony venue"} />
        <FormField label="Description" value={draft.description} onChangeText={(value) => updateDraft("description", value)} editable={!saving} multiline placeholder="Optional" />

        <View style={styles.fieldGroup}>
          <KatipanText variant="labelLarge">Budget Category</KatipanText>
          {categoryOptions.length === 0
            ? <KatipanText variant="bodySmall" color="textMuted">No active categories are available.</KatipanText>
            : <View style={styles.choiceList}>
              {categoryOptions.map((category) => <ChoiceButton
                key={category.id}
                label={`${draft.categoryId === category.id ? "✓ " : ""}${category.name}${category.archived_at ? " · Archived" : ""}`}
                selected={draft.categoryId === category.id}
                disabled={saving}
                onPress={() => updateDraft("categoryId", category.id)}
              />)}
            </View>}
          {fieldError.categoryId && <KatipanText variant="bodySmall" color="error">{fieldError.categoryId}</KatipanText>}
        </View>

        {!expenseMode && <FormField
          label="Estimated amount"
          value={draft.estimatedAmount}
          onChangeText={(value) => updateDraft("estimatedAmount", value)}
          keyboardType="decimal-pad"
          editable={!saving}
          error={fieldError.estimatedAmount}
          hint={amountHint}
          placeholder="0.00"
        />}

        {!expenseMode && <View style={styles.fieldGroup}>
          <KatipanText variant="labelLarge">Supplier (optional)</KatipanText>
          {selectedSupplier ? <EditorialCard style={styles.selectedSupplier}>
            <KatipanText variant="title">{selectedSupplier.name}</KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">{selectedSupplier.category}</KatipanText>
            <KatipanButton label="Remove Supplier" variant="text" disabled={saving} onPress={() => updateDraft("supplierId", null)} />
          </EditorialCard> : <>
            <FormField label="Search saved Suppliers" value={supplierSearch} onChangeText={setSupplierSearch} editable={!saving} placeholder="Supplier name or category" hint={suppliers.length ? "Only Suppliers in this Wedding are available." : "No Suppliers are saved in this Wedding yet."} />
            {matchingSuppliers.length > 0 && <View style={styles.choiceList}>
              {matchingSuppliers.map((supplier) => <ChoiceButton
                key={supplier.id}
                label={`${supplier.name} · ${supplier.category}`}
                selected={false}
                disabled={saving}
                onPress={() => { updateDraft("supplierId", supplier.id); setSupplierSearch(""); }}
              />)}
            </View>}
          </>}
          {selectedSupplier && <KatipanText variant="bodySmall" color="textMuted">Supplier actual payments are managed separately. This Budget Item cannot store an actual amount while it is linked to a Supplier.</KatipanText>}
          {selectedSupplier && <KatipanButton label="View Supplier Details" variant="secondary" disabled={saving} onPress={() => router.push(supplierHref(resource.weddingId, selectedSupplier.id))} />}
          {fieldError.supplierId && <KatipanText variant="bodySmall" color="error">{fieldError.supplierId}</KatipanText>}
        </View>}

        {(expenseMode || draft.supplierId === null || draft.actualAmount.trim().length > 0) && <View style={styles.fieldGroup}>
          <FormField
            label={expenseMode ? "Actual expense amount" : "Manual actual expense"}
            value={draft.actualAmount}
            onChangeText={(value) => updateDraft("actualAmount", value)}
            keyboardType="decimal-pad"
            editable={!saving}
            error={fieldError.actualAmount}
            hint={expenseMode ? amountHint : draft.supplierId ? "Clear this manual actual before linking the Supplier." : "Optional. Used only for non-Supplier Budget Items."}
            placeholder="0.00"
          />
          {draft.supplierId && draft.actualAmount.trim().length > 0 && <KatipanButton
            label="Clear manual actual"
            variant="text"
            disabled={saving}
            onPress={() => updateDraft("actualAmount", "")}
          />}
        </View>}

        {!expenseMode && <View style={styles.fieldGroup}>
          <KatipanText variant="labelLarge">Status</KatipanText>
          <View style={styles.choiceList}>
            {BUDGET_ITEM_STATUSES.map((status) => <ChoiceButton
              key={status}
              label={`${draft.status === status ? "✓ " : ""}${status}`}
              selected={draft.status === status}
              disabled={saving}
              onPress={() => updateDraft("status", status)}
            />)}
          </View>
        </View>}

        <FormField label="Notes" value={draft.notes} onChangeText={(value) => updateDraft("notes", value)} editable={!saving} multiline placeholder="Optional" />
        {actionError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{actionError}</KatipanText>}
        {item && <KatipanText variant="bodySmall" color="textMuted">Current estimate: {formatCurrency(item.estimated_amount, totals.currencyCode)}. Status changes take effect when you save.</KatipanText>}
        <KatipanButton label={expenseMode ? "Save Manual Expense" : item ? "Save Budget Item" : "Add Budget Item"} loading={saving} disabled={!canEdit || activeCategories.length === 0} onPress={() => void save()} />
      </EditorialCard>
    </KatipanScreen>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, disabled && styles.disabledChoice, pressed && styles.choicePressed]}
    >
      <KatipanText variant="labelLarge" color={selected ? "primary" : "text"}>{label}</KatipanText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: 48 },
  titleBlock: { gap: s.small },
  formCard: { gap: s.medium },
  infoCard: { gap: s.medium, backgroundColor: c.warmAlabaster },
  fieldGroup: { gap: s.small },
  choiceList: { gap: s.small },
  choice: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: s.medium,
    paddingVertical: s.small,
    borderRadius: r.medium,
    borderWidth: 1,
    borderColor: c.stoneBorder,
    backgroundColor: c.cardIvory,
  },
  choiceSelected: { backgroundColor: c.warmAlabaster, borderColor: c.primaryContainer },
  choicePressed: { opacity: 0.78 },
  disabledChoice: { opacity: 0.5 },
  selectedSupplier: { gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow },
});
