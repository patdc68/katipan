import { useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { formatCurrency } from "../budget/model";
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
import {
  filterSupplierList,
  isSupplierFinanceManager,
  supplierCategories,
  supplierEmailHref,
  supplierPhoneHref,
  supplierStatusLabel,
  supplierStatusTone,
  supplierWebsiteHref,
  SupplierSubmitGate,
  SUPPLIER_STATUS_FILTERS,
  validateSupplierCommitmentDraft,
  type SupplierCommitmentDraft,
  type SupplierCommitmentWrite,
  type SupplierListItem,
  type SupplierStatusFilter,
} from "./model";
import { setSupplierCommitment } from "./api";
import { safeSupplierError } from "./model";
import {
  useSupplierDetailsResource,
  useSupplierListResource,
} from "./use-supplier-resource";

function suppliersRoute(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget/suppliers", params: { weddingId } } as unknown as Href;
}

function supplierRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function newSupplierRoute(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget/suppliers/new", params: { weddingId } } as unknown as Href;
}

function editSupplierRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/edit",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function budgetItemRoute(weddingId: string, itemId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/items/[itemId]",
    params: { weddingId, itemId },
  } as unknown as Href;
}

function supplierPaymentsRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function newInstallmentRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/new",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function supplierInstallmentRoute(weddingId: string, supplierId: string, installmentId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/[installmentId]",
    params: { weddingId, supplierId, installmentId },
  } as unknown as Href;
}

function newSupplierPaymentRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/new",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function supplierPaymentDetailsRoute(weddingId: string, supplierId: string, paymentId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/[paymentId]",
    params: { weddingId, supplierId, paymentId },
  } as unknown as Href;
}

function displayDueDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)
    : value;
}

function supplierIdFromParams(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function SupplierFilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <KatipanText variant="labelLarge" color={selected ? "primary" : "textMuted"}>{label}</KatipanText>
    </Pressable>
  );
}

function openExternalLink(url: string, onError: () => void): void {
  void Linking.openURL(url).catch(onError);
}

function SupplierListRow({
  supplier,
  currencyCode,
  onPress,
}: {
  supplier: SupplierListItem;
  currencyCode: string;
  onPress: () => void;
}) {
  const committed = supplier.finance.committedAmount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Supplier details for ${supplier.name}`}
      onPress={onPress}
    >
      <EditorialCard style={styles.supplierRow}>
        <View style={styles.supplierAvatar} accessible={false}>
          <KatipanText variant="title" color="primary">{supplier.name.trim().slice(0, 1).toLocaleUpperCase()}</KatipanText>
        </View>
        <View style={styles.supplierRowCopy}>
          <View style={styles.supplierHeading}>
            <KatipanText variant="title" style={styles.supplierName}>{supplier.name}</KatipanText>
            <StatusChip label={supplierStatusLabel(supplier.status)} tone={supplierStatusTone(supplier.status)} />
          </View>
          <KatipanText variant="bodySmall" color="textMuted">{supplier.category}</KatipanText>
          <View style={styles.rowFinance}>
            <KatipanText variant="bodySmall" color="textMuted">
              Committed {committed === null ? "Not set" : formatCurrency(committed, currencyCode)}
            </KatipanText>
            <KatipanText variant="bodySmall" color="textMuted">
              Paid {formatCurrency(supplier.finance.actualPaid, currencyCode)}
            </KatipanText>
          </View>
          {committed !== null && (
            <KatipanText variant="bodySmall" color="secondary">
              Remaining {supplier.finance.remainingCommitment === null ? "Not available" : formatCurrency(supplier.finance.remainingCommitment, currencyCode)}
            </KatipanText>
          )}
        </View>
        <KatipanText variant="headlineSmall" color="outline">›</KatipanText>
      </EditorialCard>
    </Pressable>
  );
}

export function SupplierListScreen() {
  const router = useRouter();
  const resource = useSupplierListResource();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupplierStatusFilter>("ALL");
  const [category, setCategory] = useState<string | undefined>();

  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label="Loading Suppliers…" /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Suppliers unavailable" description="We couldn't load Suppliers. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) {
    return <KatipanScreen><EmptyState title="Supplier finance is private" description="Supplier and finance details are available to the Wedding Owners and Full Coordinators." action={<KatipanButton label="Back to Budget" variant="secondary" onPress={() => router.back()} />} /></KatipanScreen>;
  }
  if (resource.data.kind === "unavailable") {
    return <KatipanScreen><ErrorState title="Suppliers unavailable" description="This Supplier workspace isn't available for the selected Wedding." onRetry={resource.retry} /></KatipanScreen>;
  }

  const { suppliers, currencyCode } = resource.data.data;
  const categories = supplierCategories(suppliers);
  const selectedCategory = category && categories.includes(category) ? category : undefined;
  const filtered = filterSupplierList(suppliers, { search, status, category: selectedCategory });

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">BUDGET & FINANCE</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Suppliers</KatipanText>
        <KatipanText color="textMuted">Keep supplier details and agreed contract values together.</KatipanText>
      </View>

      <EditorialCard style={styles.summaryCard}>
        <View style={styles.summaryCopy}>
          <KatipanText variant="headlineSmall">{filtered.length} {filtered.length === 1 ? "Supplier" : "Suppliers"}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">Supplier commitments and actual payments are tracked separately from Budget estimates.</KatipanText>
        </View>
        <KatipanButton label="Add Supplier" onPress={() => router.push(newSupplierRoute(resource.weddingId))} />
      </EditorialCard>

      <FormField
        label="Search Suppliers"
        value={search}
        onChangeText={setSearch}
        placeholder="Name, category, contact or email"
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={styles.filterSection}>
        <KatipanText variant="labelCaps" color="secondary">STATUS</KatipanText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {SUPPLIER_STATUS_FILTERS.map((value) => (
            <SupplierFilterChip
              key={value}
              label={value === "ALL" ? "All" : supplierStatusLabel(value)}
              selected={status === value}
              onPress={() => setStatus(value)}
            />
          ))}
        </ScrollView>
      </View>

      {categories.length > 1 && (
        <View style={styles.filterSection}>
          <KatipanText variant="labelCaps" color="secondary">CATEGORY</KatipanText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            <SupplierFilterChip label="All categories" selected={!selectedCategory} onPress={() => setCategory(undefined)} />
            {categories.map((value) => (
              <SupplierFilterChip key={value} label={value} selected={selectedCategory === value} onPress={() => setCategory(value)} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.results}>
        <SectionHeader title="Your Suppliers" eyebrow={`${suppliers.length} TOTAL`} description={`Commitment and payment amounts are shown in ${currencyCode}.`} />
        {suppliers.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState
              title="No Suppliers yet"
              description="Add the people and businesses supporting your Wedding. Supplier categories stay flexible as your plans change."
              action={<KatipanButton label="Add Supplier" onPress={() => router.push(newSupplierRoute(resource.weddingId))} />}
            />
          </EditorialCard>
        ) : filtered.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No Suppliers match these filters" description="Try another name, status or category." />
          </EditorialCard>
        ) : filtered.map((supplier) => (
          <SupplierListRow
            key={supplier.id}
            supplier={supplier}
            currencyCode={currencyCode}
            onPress={() => router.push(supplierRoute(resource.weddingId, supplier.id))}
          />
        ))}
      </View>
    </KatipanScreen>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <KatipanText variant="bodySmall" color="textMuted">{label}</KatipanText>
      <KatipanText variant="body" style={styles.detailValue}>{value}</KatipanText>
    </View>
  );
}

function FinanceMetric({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <View style={styles.financeMetric}>
      <KatipanText variant="labelCaps" color="secondary">{label.toUpperCase()}</KatipanText>
      <KatipanText variant="title">{value}</KatipanText>
      <KatipanText variant="bodySmall" color="textMuted">{description}</KatipanText>
    </View>
  );
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SupplierCommitmentEditor({
  supplierId,
  membership,
  amount,
  committedOn,
  notes,
  onCancel,
  onSaved,
}: {
  supplierId: string;
  membership: NonNullable<ReturnType<typeof useSupplierDetailsResource>["membership"]>;
  amount: number | null;
  committedOn: string | null;
  notes: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<SupplierCommitmentDraft>({
    amount: amount === null ? "" : String(amount),
    committedOn: committedOn ?? "",
    notes: notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SupplierCommitmentDraft, string>>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const gate = useRef(new SupplierSubmitGate());

  const save = async () => {
    setError(null);
    const validation = validateSupplierCommitmentDraft(draft);
    if (!validation.ok) {
      setFieldErrors({ [validation.field]: validation.message });
      return;
    }
    setFieldErrors({});
    await gate.current.run(async () => {
      setSaving(true);
      try {
        await setSupplierCommitment(membership, supplierId, validation.value);
        onSaved();
      } catch (failure) {
        setError(safeSupplierError(failure, "We couldn't save this Supplier commitment. Try again."));
      } finally {
        setSaving(false);
      }
    });
  };

  const clear = async () => {
    setError(null);
    await gate.current.run(async () => {
      setSaving(true);
      try {
        const cleared: SupplierCommitmentWrite = { amount: null, committedOn: null, notes: null };
        await setSupplierCommitment(membership, supplierId, cleared);
        onSaved();
      } catch (failure) {
        setError(safeSupplierError(failure, "We couldn't clear this Supplier commitment. Try again."));
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <EditorialCard style={styles.editorCard}>
      <SectionHeader
        title={amount === null ? "Set Commitment" : "Edit Commitment"}
        description="Record the agreed Supplier or contract value. This doesn't change the Budget estimate or schedule."
      />
      <FormField
        label="Committed amount"
        value={draft.amount}
        onChangeText={(value) => {
          setDraft((current) => ({ ...current, amount: value }));
          setFieldErrors((current) => ({ ...current, amount: undefined }));
        }}
        keyboardType="decimal-pad"
        editable={!saving}
        placeholder="0.00"
        hint="Enter zero or more. Use the Wedding currency."
        error={fieldErrors.amount}
      />
      <FormField
        label="Commitment date"
        value={draft.committedOn}
        onChangeText={(value) => {
          setDraft((current) => ({ ...current, committedOn: value }));
          setFieldErrors((current) => ({ ...current, committedOn: undefined }));
        }}
        editable={!saving}
        placeholder="YYYY-MM-DD"
        hint="Optional date the commitment was agreed."
        error={fieldErrors.committedOn}
      />
      <FormField
        label="Commitment notes"
        value={draft.notes}
        onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
        editable={!saving}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={styles.notesInput}
        placeholder="Add contract context or agreed scope"
      />
      {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
      {confirmClear ? (
        <View style={styles.clearConfirmation}>
          <KatipanText variant="bodySmall">Clear the commitment amount, date and notes?</KatipanText>
          <View style={styles.inlineActions}>
            <KatipanButton label="Keep commitment" variant="secondary" disabled={saving} onPress={() => setConfirmClear(false)} />
            <KatipanButton label="Confirm clear" variant="text" loading={saving} disabled={saving} onPress={() => void clear()} />
          </View>
        </View>
      ) : (
        <View style={styles.formActions}>
          <KatipanButton label="Save commitment" loading={saving} disabled={saving} onPress={() => void save()} />
          {amount !== null && <KatipanButton label="Clear commitment" variant="text" disabled={saving} onPress={() => setConfirmClear(true)} />}
          <KatipanButton label="Cancel" variant="secondary" disabled={saving} onPress={onCancel} />
        </View>
      )}
    </EditorialCard>
  );
}

export function SupplierDetailsScreen() {
  const params = useLocalSearchParams<{ supplierId?: string | string[] }>();
  const supplierId = supplierIdFromParams(params.supplierId);
  const router = useRouter();
  const resource = useSupplierDetailsResource(supplierId);
  const [editingCommitment, setEditingCommitment] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  if (!supplierId) return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label="Loading Supplier details…" /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Supplier unavailable" description="We couldn't load this Supplier. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) {
    return <KatipanScreen><EmptyState title="Supplier finance is private" description="Supplier and finance details are available to the Wedding Owners and Full Coordinators." action={<KatipanButton label="Back to Budget" variant="secondary" onPress={() => router.back()} />} /></KatipanScreen>;
  }
  if (resource.data.kind === "unavailable") {
    return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={resource.retry} /></KatipanScreen>;
  }

  const { supplier, finance, budgetItems, contractDocuments, upcomingInstallments, recentPayments, currencyCode } = resource.data.data;
  const goBack = () => router.canGoBack() ? router.back() : router.replace(suppliersRoute(resource.weddingId));
  const websiteHref = supplierWebsiteHref(supplier.website);
  const emailHref = supplierEmailHref(supplier.email);
  const phoneHref = supplierPhoneHref(supplier.phone);
  const contactActions = [
    emailHref ? { label: "Email", href: emailHref } : null,
    phoneHref ? { label: "Call", href: phoneHref } : null,
    websiteHref ? { label: "Website", href: websiteHref } : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Suppliers" variant="text" onPress={goBack} style={styles.backButton} />

      <EditorialCard style={styles.identityCard}>
        <View style={styles.identityHeading}>
          <View style={styles.identityCopy}>
            <KatipanText variant="labelCaps" color="secondary">{supplier.category.toLocaleUpperCase()}</KatipanText>
            <KatipanText variant="headlineLarge" accessibilityRole="header">{supplier.name}</KatipanText>
          </View>
          <StatusChip label={supplierStatusLabel(supplier.status)} tone={supplierStatusTone(supplier.status)} />
        </View>
        <KatipanButton label="Edit Supplier" variant="secondary" onPress={() => router.push(editSupplierRoute(resource.weddingId, supplier.id))} />
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader title="Contact & Notes" description="Supplier contact details for your planning team." />
        <EditorialCard style={styles.contactCard}>
          {supplier.contact_name && <DetailLine label="Contact person" value={supplier.contact_name} />}
          {supplier.email && <DetailLine label="Email" value={supplier.email} />}
          {supplier.phone && <DetailLine label="Phone" value={supplier.phone} />}
          {supplier.website && <DetailLine label="Website" value={supplier.website} />}
          {!supplier.contact_name && !supplier.email && !supplier.phone && !supplier.website && (
            <KatipanText color="textMuted">No contact details have been added.</KatipanText>
          )}
          {contactActions.length > 0 && (
            <View style={styles.inlineActions}>
              {contactActions.map((action) => (
                <KatipanButton
                  key={action.label}
                  label={action.label}
                  variant="secondary"
              onPress={() => {
                setLinkError(null);
                openExternalLink(action.href, () => setLinkError("This link isn't available on this device."));
              }}
                />
              ))}
            </View>
          )}
          {!!linkError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{linkError}</KatipanText>}
          <View style={styles.noteDivider} />
          <KatipanText variant="labelCaps" color="secondary">SUPPLIER NOTES</KatipanText>
          {supplier.notes ? (
            <KatipanText style={styles.longText}>{supplier.notes}</KatipanText>
          ) : (
            <KatipanText variant="bodySmall" color="textMuted">No Supplier notes yet.</KatipanText>
          )}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Supplier Commitment"
          description="The agreed contract value stays separate from Budget estimates and payment activity."
          action={<KatipanButton label={editingCommitment ? "Close" : finance.committedAmount === null ? "Set" : "Edit"} variant="text" onPress={() => setEditingCommitment((current) => !current)} />}
        />
        {editingCommitment ? (
          <SupplierCommitmentEditor
            key={`${supplier.id}:${finance.committedAmount ?? "none"}:${supplier.committed_on ?? ""}`}
            supplierId={supplier.id}
            membership={resource.membership}
            amount={finance.committedAmount}
            committedOn={supplier.committed_on}
            notes={supplier.commitment_notes}
            onCancel={() => setEditingCommitment(false)}
            onSaved={() => { setEditingCommitment(false); resource.retry(); }}
          />
        ) : (
          <EditorialCard style={styles.commitmentCard}>
            <KatipanText variant="labelCaps" color="secondary">AGREED CONTRACT VALUE</KatipanText>
            <KatipanText variant="headlineMedium">
              {finance.committedAmount === null ? "No commitment recorded" : formatCurrency(finance.committedAmount, currencyCode)}
            </KatipanText>
            {supplier.committed_on && <DetailLine label="Agreed on" value={supplier.committed_on} />}
            {supplier.commitment_notes ? <KatipanText style={styles.longText}>{supplier.commitment_notes}</KatipanText> : (
              finance.committedAmount === null
                ? <KatipanText variant="bodySmall" color="textMuted">Set a commitment when a Supplier contract value is agreed.</KatipanText>
                : <KatipanText variant="bodySmall" color="textMuted">No commitment notes.</KatipanText>
            )}
          </EditorialCard>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Finance Summary" description={`Canonical Supplier totals in ${currencyCode}.`} />
        <EditorialCard style={styles.financeCard}>
          <FinanceMetric
            label="Committed"
            value={finance.committedAmount === null ? "Not set" : formatCurrency(finance.committedAmount, currencyCode)}
            description="Agreed Supplier contract value."
          />
          <FinanceMetric
            label="Scheduled"
            value={formatCurrency(finance.scheduledAmount, currencyCode)}
            description={finance.scheduledAmount === 0 ? "No active installment schedule yet." : "Active installment schedule total."}
          />
          <FinanceMetric
            label="Paid"
            value={formatCurrency(finance.actualPaid, currencyCode)}
            description="Net PAYMENT minus REVERSAL transactions."
          />
          <FinanceMetric
            label="Remaining Commitment"
            value={finance.remainingCommitment === null ? "Not available" : formatCurrency(finance.remainingCommitment, currencyCode)}
            description="Commitment minus net actual paid."
          />
          <FinanceMetric
            label="Overdue"
            value={formatCurrency(finance.overdueBalance, currencyCode)}
            description={finance.overdueBalance === 0 ? "No overdue installment balance." : "Unpaid balance on overdue installments."}
          />
          <FinanceMetric
            label="Unscheduled Paid"
            value={formatCurrency(finance.unscheduledPaid, currencyCode)}
            description="Net Supplier payments not tied to an installment."
          />
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Payment Schedule"
          description="Planned installments and recent actual payments stay separate."
          action={<KatipanButton label="View all" variant="text" onPress={() => router.push(supplierPaymentsRoute(resource.weddingId, supplier.id))} />}
        />
        <EditorialCard style={styles.paymentPreviewCard}>
          <View style={styles.inlineActions}>
            <KatipanButton label="Record Payment" onPress={() => router.push(newSupplierPaymentRoute(resource.weddingId, supplier.id))} />
            <KatipanButton label="Add Installment" variant="secondary" onPress={() => router.push(newInstallmentRoute(resource.weddingId, supplier.id))} />
          </View>
          <KatipanText variant="labelCaps" color="secondary">UPCOMING AND OVERDUE</KatipanText>
          {upcomingInstallments.length === 0 ? (
            <KatipanText variant="bodySmall" color="textMuted">No upcoming or overdue installments.</KatipanText>
          ) : upcomingInstallments.map((installment) => (
            <Pressable
              key={installment.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${installment.status.toLocaleLowerCase().replaceAll("_", " ")} installment due ${displayDueDate(installment.dueDate)}`}
              onPress={() => router.push(supplierInstallmentRoute(resource.weddingId, supplier.id, installment.id))}
            >
              <View style={styles.previewRow}>
                <View style={styles.supplierRowCopy}>
                  <KatipanText variant="title">{formatCurrency(installment.amount, currencyCode)} · {displayDueDate(installment.dueDate)}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">
                    Paid {formatCurrency(installment.paidAmount, currencyCode)} · Unpaid {formatCurrency(installment.unpaidBalance, currencyCode)}
                  </KatipanText>
                  {installment.budgetItemName && <KatipanText variant="bodySmall" color="textMuted">{installment.budgetItemName}</KatipanText>}
                  {installment.notes && <KatipanText variant="bodySmall" color="textMuted" numberOfLines={2}>{installment.notes}</KatipanText>}
                </View>
                <StatusChip label={installment.status.replaceAll("_", " ")} tone={installment.status === "OVERDUE" ? "error" : installment.status === "PARTIALLY_PAID" ? "warning" : "neutral"} />
              </View>
            </Pressable>
          ))}
          <View style={styles.noteDivider} />
          <KatipanText variant="labelCaps" color="secondary">RECENT ACTUAL PAYMENTS</KatipanText>
          {recentPayments.length === 0 ? (
            <KatipanText variant="bodySmall" color="textMuted">No Supplier payments recorded yet.</KatipanText>
          ) : recentPayments.map((payment) => (
            <Pressable
              key={payment.id}
              accessibilityRole="button"
              accessibilityLabel={`View payment of ${formatCurrency(payment.amount, currencyCode)}`}
              onPress={() => router.push(supplierPaymentDetailsRoute(resource.weddingId, supplier.id, payment.id))}
            >
              <View style={styles.previewRow}>
                <View style={styles.supplierRowCopy}>
                  <KatipanText variant="title">{formatCurrency(payment.amount, currencyCode)}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">
                    {Number.isFinite(Date.parse(payment.paid_at)) ? new Date(payment.paid_at).toLocaleDateString() : payment.paid_at}
                  </KatipanText>
                </View>
                {payment.reversed && <StatusChip label="Reversed" tone="error" />}
              </View>
            </Pressable>
          ))}
        </EditorialCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Linked Budget Items" description="Budget estimates remain separate from Supplier actual payments." />
        {budgetItems.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No linked Budget Items" description="Link a Budget Item to this Supplier from the existing Budget flow." />
          </EditorialCard>
        ) : budgetItems.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Open Budget Item ${item.name}`}
            onPress={() => router.push(budgetItemRoute(resource.weddingId, item.id))}
          >
            <EditorialCard style={styles.budgetItemCard}>
              <View style={styles.budgetItemHeading}>
                <View style={styles.supplierRowCopy}>
                  <KatipanText variant="title">{item.name}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{item.categoryName}</KatipanText>
                </View>
                <StatusChip label={item.status} tone={item.status === "CONFIRMED" ? "success" : item.status === "CANCELLED" ? "error" : "neutral"} />
              </View>
              <View style={styles.itemEstimatedLine}>
                <KatipanText variant="labelCaps" color="secondary">ESTIMATED AMOUNT</KatipanText>
                <KatipanText variant="title">{formatCurrency(item.estimated_amount, currencyCode)}</KatipanText>
              </View>
              <KatipanText variant="bodySmall" color="textMuted">Supplier actual_amount stays empty; actual spending comes from Supplier payment transactions.</KatipanText>
            </EditorialCard>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Contract Documents" description="Private contract and document metadata already linked to this Supplier." />
        {contractDocuments.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No contract documents" description="There are no linked Supplier contracts or documents yet." />
          </EditorialCard>
        ) : (
          <EditorialCard style={styles.documentsCard}>
            {contractDocuments.map((document) => (
              <View key={document.id} style={styles.documentRow}>
                <View style={styles.supplierRowCopy}>
                  <KatipanText variant="title">{document.original_filename}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{document.content_type}</KatipanText>
                </View>
                {formatFileSize(document.size_bytes) && <KatipanText variant="bodySmall" color="textMuted">{formatFileSize(document.size_bytes)}</KatipanText>}
              </View>
            ))}
          </EditorialCard>
        )}
        <KatipanText variant="bodySmall" color="textMuted">Payment receipts are managed from Payment Details. Supplier contract uploads remain separate.</KatipanText>
      </View>
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  summaryCard: { gap: s.medium, padding: s.medium, backgroundColor: c.surfaceLow },
  summaryCopy: { gap: s.micro },
  filterSection: { gap: s.small },
  filterList: { gap: s.small, paddingRight: s.medium },
  filterChip: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: s.medium, borderRadius: r.pill, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.pearlIvory },
  filterChipSelected: { backgroundColor: c.warmAlabaster, borderColor: c.primaryContainer },
  results: { gap: s.medium },
  supplierRow: { flexDirection: "row", alignItems: "center", gap: s.small, padding: s.medium },
  supplierAvatar: { width: 44, height: 44, borderRadius: r.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryFixed, borderWidth: 1, borderColor: c.stoneBorder },
  supplierRowCopy: { flex: 1, gap: s.micro },
  supplierHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  supplierName: { flex: 1 },
  rowFinance: { flexDirection: "row", flexWrap: "wrap", columnGap: s.medium, rowGap: s.micro },
  emptyCard: { padding: 0 },
  backButton: { alignSelf: "flex-start" },
  identityCard: { gap: s.large },
  identityHeading: { flexDirection: "row", alignItems: "flex-start", gap: s.medium },
  identityCopy: { flex: 1, gap: s.small },
  section: { gap: s.medium },
  contactCard: { gap: s.medium },
  detailLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  detailValue: { flex: 1, textAlign: "right" },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  noteDivider: { height: 1, backgroundColor: c.stoneBorder, marginVertical: s.small },
  longText: { flexWrap: "wrap", lineHeight: 24 },
  commitmentCard: { gap: s.medium },
  financeCard: { gap: s.medium },
  paymentPreviewCard: { gap: s.medium },
  previewRow: { flexDirection: "row", alignItems: "center", gap: s.medium, paddingVertical: s.small, borderBottomWidth: 1, borderBottomColor: c.stoneBorder },
  financeMetric: { gap: s.micro, paddingVertical: s.small, borderBottomWidth: 1, borderBottomColor: c.stoneBorder },
  editorCard: { gap: s.medium },
  notesInput: { minHeight: 112, paddingTop: s.medium },
  formActions: { gap: s.small },
  clearConfirmation: { gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow, borderRadius: r.large },
  budgetItemCard: { gap: s.medium, padding: s.medium },
  budgetItemHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.small },
  itemEstimatedLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.medium },
  documentsCard: { gap: s.medium },
  documentRow: { flexDirection: "row", alignItems: "center", gap: s.medium, borderBottomWidth: 1, borderBottomColor: c.stoneBorder, paddingBottom: s.medium },
});
