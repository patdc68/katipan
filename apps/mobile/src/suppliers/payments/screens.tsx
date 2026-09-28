import { useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { formatCurrency } from "../../budget/model";
import { useAccess } from "../../onboarding/provider";
import WeddingDateField from "../../onboarding/WeddingDateField";
import DateTimeField from "../../run-of-show/DateTimeField";
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
} from "../../ui";
import { isSupplierFinanceManager, SupplierSubmitGate } from "../model";
import {
  cancelSupplierInstallment,
  createSupplierInstallment,
  deleteSupplierPaymentReceipt,
  openSupplierPaymentReceipt,
  recordSupplierPayment,
  refreshSupplierFinanceAggregates,
  reverseSupplierPayment,
  updateSupplierInstallment,
  uploadSupplierPaymentReceipt,
} from "./api";
import {
  createPendingSupplierPayment,
  installmentStatusLabel,
  installmentStatusTone,
  isDefinitivePaymentRejection,
  safeInstallmentError,
  safeReceiptError,
  safeReversalError,
  safeSupplierPaymentError,
  validateInstallmentDraft,
  validatePaymentDraft,
  type InstallmentDraft,
  type PaymentDraft,
  type PendingSupplierPayment,
  type SupplierPaymentScheduleData,
} from "./model";
import {
  clearPendingSupplierPayment,
  readPendingSupplierPayment,
  savePendingSupplierPayment,
  type PendingAttemptRead,
} from "./pending-attempt-store";
import {
  useSupplierPaymentDetailsResource,
  useSupplierPaymentScheduleResource,
} from "../use-supplier-resource";

type SelectOption = { value: string; label: string; detail?: string };

function supplierDetailsRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function supplierPaymentsRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function supplierInstallmentRoute(weddingId: string, supplierId: string, installmentId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/[installmentId]",
    params: { weddingId, supplierId, installmentId },
  } as unknown as Href;
}

function newInstallmentRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/installments/new",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function newPaymentRoute(weddingId: string, supplierId: string, installmentId?: string | null): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/new",
    params: { weddingId, supplierId, ...(installmentId ? { installmentId } : {}) },
  } as unknown as Href;
}

function paymentDetailsRoute(weddingId: string, supplierId: string, paymentId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]/payments/[paymentId]",
    params: { weddingId, supplierId, paymentId },
  } as unknown as Href;
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function displayDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)
    : value;
}

function displayTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function displaySize(size: number | null): string | null {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function FinancePrivate({ onBack }: { onBack: () => void }) {
  return (
    <KatipanScreen>
      <EmptyState
        title="Supplier finance is private"
        description="Supplier and finance details are available to the Wedding Owners and Full Coordinators."
        action={<KatipanButton label="Back to Supplier" variant="secondary" onPress={onBack} />}
      />
    </KatipanScreen>
  );
}

function PaymentSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <>
      <View style={styles.field}>
        <KatipanText variant="labelLarge">{label}</KatipanText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? "Choose an option"}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[styles.selectField, disabled && styles.disabled]}
        >
          <KatipanText>{selected?.label ?? "Choose an option"}</KatipanText>
          {selected?.detail && <KatipanText variant="bodySmall" color="textMuted">{selected.detail}</KatipanText>}
        </Pressable>
        {hint && <KatipanText variant="bodySmall" color="textMuted">{hint}</KatipanText>}
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalShell}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label} choices`} style={styles.scrim} onPress={() => setOpen(false)} />
          <View style={styles.modalSheet}>
            <KatipanText variant="headlineSmall">{label}</KatipanText>
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === value }}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                  style={[styles.option, option.value === value && styles.optionSelected]}
                >
                  <KatipanText variant="title">{option.label}</KatipanText>
                  {option.detail && <KatipanText variant="bodySmall" color="textMuted">{option.detail}</KatipanText>}
                </Pressable>
              ))}
            </ScrollView>
            <KatipanButton label="Close" variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function InstallmentCard({
  item,
  currencyCode,
  onPress,
  onRecord,
}: {
  item: SupplierPaymentScheduleData["installments"][number];
  currencyCode: string;
  onPress: () => void;
  onRecord: () => void;
}) {
  return (
    <EditorialCard style={styles.installmentCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit installment due ${displayDate(item.dueDate)}`} onPress={onPress}>
        <View style={styles.cardHeading}>
          <View style={styles.grow}>
            <KatipanText variant="title">{displayDate(item.dueDate)}</KatipanText>
            <KatipanText variant="headlineSmall">{formatCurrency(item.amount, currencyCode)}</KatipanText>
          </View>
          <StatusChip label={installmentStatusLabel(item.status)} tone={installmentStatusTone(item.status)} />
        </View>
      </Pressable>
      <View style={styles.metricLine}>
        <MetricLine label="Paid" value={formatCurrency(item.paidAmount, currencyCode)} />
        <MetricLine label="Unpaid" value={formatCurrency(item.unpaidBalance, currencyCode)} />
      </View>
      {item.budgetItemName && <DetailLine label="Budget Item" value={item.budgetItemName} />}
      {item.notes && <DetailLine label="Notes" value={item.notes} />}
      {item.status !== "CANCELLED" && <KatipanButton label="Record payment for installment" variant="secondary" onPress={onRecord} />}
    </EditorialCard>
  );
}

export function SupplierPaymentScheduleScreen() {
  const params = useLocalSearchParams<{ supplierId?: string | string[] }>();
  const supplierId = routeParam(params.supplierId);
  const router = useRouter();
  const resource = useSupplierPaymentScheduleResource(supplierId);
  if (!supplierId) return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (resource.loading || (resource.membership && !resource.isCurrent)) return <KatipanScreen><LoadingState label="Loading payment schedule…" /></KatipanScreen>;
  if (!resource.membership || !resource.isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (resource.error || !resource.data) return <KatipanScreen><ErrorState title="Payment schedule unavailable" description="We couldn't load Supplier finance. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) {
    return <FinancePrivate onBack={() => router.replace(supplierDetailsRoute(resource.weddingId, supplierId))} />;
  }
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={() => router.replace(supplierDetailsRoute(resource.weddingId, supplierId))} /></KatipanScreen>;

  const { data } = resource.data;
  const active = data.installments.filter((item) => item.status !== "CANCELLED");
  const cancelled = data.installments.filter((item) => item.status === "CANCELLED");
  const goBack = () => router.canGoBack() ? router.back() : router.replace(supplierDetailsRoute(resource.weddingId, supplierId));
  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Supplier" variant="text" onPress={goBack} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">{data.supplier.category.toLocaleUpperCase()}</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Payment Schedule</KatipanText>
        <KatipanText color="textMuted">{data.supplier.name}</KatipanText>
      </View>
      <EditorialCard style={styles.totalsCard}>
        <SectionHeader title="Supplier totals" description={`Canonical finance totals in ${data.currencyCode}.`} />
        <View style={styles.metricLine}>
          <MetricLine label="Scheduled" value={formatCurrency(data.finance.scheduledAmount, data.currencyCode)} />
          <MetricLine label="Paid" value={formatCurrency(data.finance.actualPaid, data.currencyCode)} />
          <MetricLine label="Overdue" value={formatCurrency(data.finance.overdueBalance, data.currencyCode)} />
        </View>
      </EditorialCard>
      <View style={styles.inlineActions}>
        <KatipanButton label="Record Payment" onPress={() => router.push(newPaymentRoute(resource.weddingId, supplierId))} />
        <KatipanButton label="Add Installment" variant="secondary" onPress={() => router.push(newInstallmentRoute(resource.weddingId, supplierId))} />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Installments" description="Paid and unpaid amounts come from the authoritative installment schedule." />
        {active.length === 0 ? <EditorialCard style={styles.emptyCard}><EmptyState title="No installments yet" description="Add a due amount when part of the Supplier commitment is scheduled." action={<KatipanButton label="Add Installment" onPress={() => router.push(newInstallmentRoute(resource.weddingId, supplierId))} />} /></EditorialCard> : active.map((item) => (
          <InstallmentCard
            key={item.id}
            item={item}
            currencyCode={data.currencyCode}
            onPress={() => router.push(supplierInstallmentRoute(resource.weddingId, supplierId, item.id))}
            onRecord={() => router.push(newPaymentRoute(resource.weddingId, supplierId, item.id))}
          />
        ))}
      </View>
      {cancelled.length > 0 && <View style={styles.section}>
        <SectionHeader title="Cancelled installments" description="Cancellation preserves the installment and its payment history." />
        {cancelled.map((item) => <InstallmentCard key={item.id} item={item} currencyCode={data.currencyCode} onPress={() => router.push(supplierInstallmentRoute(resource.weddingId, supplierId, item.id))} onRecord={() => {}} />)}
      </View>}
      <View style={styles.section}>
        <SectionHeader title="Recent actual payments" description="Actual payments and reversals stay in the append-only ledger." />
        {data.recentPayments.length === 0 ? <EditorialCard style={styles.emptyCard}><EmptyState title="No payments recorded" description="A payment only appears here after it has been recorded." /></EditorialCard> : data.recentPayments.map((payment) => (
          <Pressable key={payment.id} accessibilityRole="button" accessibilityLabel={`Open payment ${formatCurrency(payment.amount, data.currencyCode)}`} onPress={() => router.push(paymentDetailsRoute(resource.weddingId, supplierId, payment.id))}>
            <EditorialCard style={styles.paymentRow}>
              <View style={styles.cardHeading}>
                <View style={styles.grow}>
                  <KatipanText variant="title">{formatCurrency(payment.amount, data.currencyCode)}</KatipanText>
                  <KatipanText variant="bodySmall" color="textMuted">{displayTimestamp(payment.paid_at)}</KatipanText>
                </View>
                {payment.reversed && <StatusChip label="Reversed" tone="error" />}
              </View>
            </EditorialCard>
          </Pressable>
        ))}
      </View>
    </KatipanScreen>
  );
}

export function SupplierInstallmentEditorScreen({ isNew }: { isNew: boolean }) {
  const params = useLocalSearchParams<{ supplierId?: string | string[]; installmentId?: string | string[] }>();
  const supplierId = routeParam(params.supplierId);
  const installmentId = routeParam(params.installmentId);
  const router = useRouter();
  const resource = useSupplierPaymentScheduleResource(supplierId);
  const [draft, setDraft] = useState<InstallmentDraft | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const gate = useRef(new SupplierSubmitGate());

  const readyData = resource.data?.kind === "ready" ? resource.data.data : null;
  const installment = !isNew && readyData ? readyData.installments.find((item) => item.id === installmentId) ?? null : null;
  const initialDraft: InstallmentDraft = installment
    ? { amount: String(installment.amount), dueDate: installment.dueDate, budgetItemId: installment.budgetItemId, notes: installment.notes ?? "" }
    : { amount: "", dueDate: "", budgetItemId: null, notes: "" };
  const draftValue = draft ?? initialDraft;

  if (!supplierId || (!isNew && !installmentId)) return <KatipanScreen><ErrorState title="Installment unavailable" description="This installment isn't available in the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (resource.loading || (resource.membership && !resource.isCurrent)) return <KatipanScreen><LoadingState label="Loading installment…" /></KatipanScreen>;
  if (!resource.membership || !resource.isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (resource.error || !resource.data) return <KatipanScreen><ErrorState title="Installment unavailable" description="We couldn't load this Supplier installment. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) return <FinancePrivate onBack={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} />;
  if (resource.data.kind === "unavailable" || (!isNew && !installment)) return <KatipanScreen><ErrorState title="Installment unavailable" description="This installment isn't available in the selected Wedding." onRetry={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} /></KatipanScreen>;

  const data = resource.data.data;
  const cancelled = installment?.status === "CANCELLED";
  const goBack = () => router.canGoBack() ? router.back() : router.replace(supplierPaymentsRoute(resource.weddingId, supplierId));
  const save = async () => {
    setError(null);
    const validation = validateInstallmentDraft(draftValue, data.budgetItems);
    if (!validation.ok) { setFieldError(validation.message); return; }
    setFieldError(null);
    await gate.current.run(async () => {
      setSaving(true);
      try {
        if (isNew) await createSupplierInstallment(resource.membership!, supplierId, draftValue);
        else await updateSupplierInstallment(resource.membership!, supplierId, installmentId, draftValue, data.budgetItems);
        try { await refreshSupplierFinanceAggregates(resource.membership!, supplierId); } catch { /* The schedule destination reloads canonical rows. */ }
        router.replace(supplierPaymentsRoute(resource.weddingId, supplierId));
      } catch (failure) {
        setError(safeInstallmentError(failure));
      } finally {
        setSaving(false);
      }
    });
  };
  const cancel = async () => {
    await gate.current.run(async () => {
      setSaving(true);
      setError(null);
      try {
        await cancelSupplierInstallment(resource.membership!, supplierId, installmentId);
        try { await refreshSupplierFinanceAggregates(resource.membership!, supplierId); } catch { /* The schedule destination reloads canonical rows. */ }
        router.replace(supplierPaymentsRoute(resource.weddingId, supplierId));
      } catch (failure) {
        setError(safeInstallmentError(failure));
      } finally {
        setSaving(false);
      }
    });
  };

  const budgetOptions: SelectOption[] = [
    { value: "", label: "No linked Budget Item", detail: "The installment stays at Supplier level." },
    ...data.budgetItems.map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Payment Schedule" variant="text" onPress={goBack} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">{data.supplier.name}</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{isNew ? "Add Installment" : "Edit Installment"}</KatipanText>
        <KatipanText color="textMuted">Set the planned due amount separately from actual payments.</KatipanText>
      </View>
      <EditorialCard style={styles.formCard}>
        {!isNew && installment && <View style={styles.inlineActions}><StatusChip label={installmentStatusLabel(installment.status)} tone={installmentStatusTone(installment.status)} /></View>}
        <FormField
          label="Installment amount"
          value={draftValue.amount}
          onChangeText={(amount) => setDraft((current) => ({ ...(current ?? initialDraft), amount }))}
          keyboardType="decimal-pad"
          editable={!saving && !cancelled}
          placeholder="0.00"
          hint={`Enter the scheduled amount in ${data.currencyCode}.`}
          error={fieldError?.includes("amount") ? fieldError : undefined}
        />
        <WeddingDateField
          label="Due date"
          date={draftValue.dueDate}
          disabled={saving || Boolean(cancelled)}
          onChange={(dueDate) => setDraft((current) => ({ ...(current ?? initialDraft), dueDate }))}
        />
        <PaymentSelectField
          label="Linked Budget Item"
          value={draftValue.budgetItemId ?? ""}
          options={budgetOptions}
          disabled={saving || Boolean(cancelled)}
          hint="Optional. The selected item must already belong to this Supplier."
          onChange={(budgetItemId) => setDraft((current) => ({ ...(current ?? initialDraft), budgetItemId: budgetItemId || null }))}
        />
        <FormField
          label="Installment notes"
          value={draftValue.notes}
          onChangeText={(notes) => setDraft((current) => ({ ...(current ?? initialDraft), notes }))}
          editable={!saving && !cancelled}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.notesInput}
          placeholder="Add due date or scope context"
        />
        {!!fieldError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{fieldError}</KatipanText>}
        {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
        {cancelled ? (
          <KatipanText variant="bodySmall" color="textMuted">This installment is cancelled and cannot be changed.</KatipanText>
        ) : confirmCancel ? (
          <EditorialCard style={styles.confirmCard}>
            <KatipanText variant="title">Cancel this installment?</KatipanText>
            <KatipanText color="textMuted">The installment and its payments stay in the ledger. This will not change the Supplier commitment or Budget Item actual amount.</KatipanText>
            <View style={styles.inlineActions}>
              <KatipanButton label="Keep installment" variant="secondary" disabled={saving} onPress={() => setConfirmCancel(false)} />
              <KatipanButton label="Confirm cancellation" variant="text" loading={saving} disabled={saving} onPress={() => void cancel()} />
            </View>
          </EditorialCard>
        ) : (
          <View style={styles.formActions}>
            <KatipanButton label={isNew ? "Add Installment" : "Save Installment"} loading={saving} disabled={saving} onPress={() => void save()} />
            {!isNew && <KatipanButton label="Cancel Installment" variant="secondary" disabled={saving} onPress={() => setConfirmCancel(true)} />}
            <KatipanButton label="Back" variant="text" disabled={saving} onPress={goBack} />
          </View>
        )}
      </EditorialCard>
    </KatipanScreen>
  );
}

type PaymentAttemptState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "unreadable" }
  | { kind: "pending"; attempt: PendingSupplierPayment; persisted: boolean };

function samePaymentRoute(attempt: PendingSupplierPayment, weddingId: string, supplierId: string): boolean {
  return attempt.weddingId === weddingId && attempt.supplierId === supplierId;
}

function PendingPaymentSummary({
  attempt,
  schedule,
}: {
  attempt: PendingSupplierPayment;
  schedule: SupplierPaymentScheduleData;
}) {
  const installment = attempt.installmentId ? schedule.installments.find((row) => row.id === attempt.installmentId) : null;
  const budgetItem = attempt.budgetItemId ? schedule.budgetItems.find((row) => row.id === attempt.budgetItemId) : null;
  return (
    <EditorialCard style={styles.pendingCard}>
      <KatipanText variant="labelCaps" color="secondary">SAME PAYMENT ATTEMPT</KatipanText>
      <KatipanText variant="title">{formatCurrency(attempt.amount, schedule.currencyCode)}</KatipanText>
      <DetailLine label="Paid at" value={displayTimestamp(attempt.paidAt)} />
      <DetailLine label="Supplier" value={schedule.supplier.name} />
      <DetailLine label="Installment" value={installment ? displayDate(installment.dueDate) : "Outside schedule (unscheduled)"} />
      <DetailLine label="Budget Item" value={budgetItem?.name ?? "Not linked"} />
      {attempt.paymentMethod && <DetailLine label="Method" value={attempt.paymentMethod} />}
      {attempt.referenceNumber && <DetailLine label="Reference" value={attempt.referenceNumber} />}
      {attempt.notes && <DetailLine label="Notes" value={attempt.notes} />}
    </EditorialCard>
  );
}

export function SupplierPaymentEditorScreen() {
  const params = useLocalSearchParams<{ supplierId?: string | string[]; installmentId?: string | string[] }>();
  const supplierId = routeParam(params.supplierId);
  const routeInstallmentId = routeParam(params.installmentId);
  const router = useRouter();
  const access = useAccess();
  const resource = useSupplierPaymentScheduleResource(supplierId);
  const userId = access.session?.user.id ?? "";
  const [draft, setDraft] = useState<Partial<PaymentDraft>>({});
  const [attemptSnapshot, setAttemptSnapshot] = useState<{ userId: string; state: PaymentAttemptState }>({
    userId,
    state: userId ? { kind: "loading" } : { kind: "empty" },
  });
  const attemptState: PaymentAttemptState = attemptSnapshot.userId === userId
    ? attemptSnapshot.state
    : userId ? { kind: "loading" } : { kind: "empty" };
  const setAttemptState = (state: PaymentAttemptState) => setAttemptSnapshot({ userId, state });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const actionInProgress = useRef(false);
  const gate = useRef(new SupplierSubmitGate());

  useEffect(() => {
    let current = true;
    if (!userId) return () => { current = false; };
    void readPendingSupplierPayment(userId).then((saved: PendingAttemptRead) => {
      if (!current) return;
      const state = saved.kind === "pending" ? { kind: "pending" as const, attempt: saved.attempt, persisted: true } : saved;
      setAttemptSnapshot({ userId, state });
    });
    return () => { current = false; };
  }, [userId]);

  const readyData = resource.data?.kind === "ready" ? resource.data.data : null;
  const routeInstallment = routeInstallmentId && readyData
    ? readyData.installments.find((item) => item.id === routeInstallmentId && item.status !== "CANCELLED") ?? null
    : null;
  const draftValue: PaymentDraft = {
    amount: "",
    paidAt: null,
    targetChoice: routeInstallment ? "INSTALLMENT" : "UNSELECTED",
    installmentId: routeInstallment?.id ?? null,
    budgetItemId: routeInstallment?.budgetItemId ?? null,
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
    ...draft,
  };

  if (!supplierId) return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (resource.loading || (resource.membership && !resource.isCurrent) || attemptState.kind === "loading") return <KatipanScreen><LoadingState label="Loading payment details…" /></KatipanScreen>;
  if (!resource.membership || !resource.isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (resource.error || !resource.data) return <KatipanScreen><ErrorState title="Payment form unavailable" description="We couldn't load Supplier finance. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) return <FinancePrivate onBack={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} />;
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} /></KatipanScreen>;

  const data = resource.data.data;
  const pending = attemptState.kind === "pending" ? attemptState.attempt : null;
  const pendingMatches = pending ? samePaymentRoute(pending, resource.weddingId, supplierId) : false;
  const back = () => router.canGoBack() ? router.back() : router.replace(supplierPaymentsRoute(resource.weddingId, supplierId));

  const sendAttempt = async (attempt: PendingSupplierPayment, persisted: boolean) => {
    await gate.current.run(async () => {
      setSaving(true);
      setError(null);
      let hasPersistedAttempt = persisted;
      try {
        if (!persisted) {
          await savePendingSupplierPayment(attempt);
          hasPersistedAttempt = true;
          setAttemptState({ kind: "pending", attempt, persisted: true });
        }
        const paymentId = await recordSupplierPayment(resource.membership!, attempt);
        // A committed payment is definitive success. A failed local cleanup is safe because the
        // backend returns the same transaction ID for the next exact replay.
        try { await clearPendingSupplierPayment(attempt); } catch { /* Preserve the request for exact replay. */ }
        setAttemptState({ kind: "empty" });
        try { await refreshSupplierFinanceAggregates(resource.membership!, supplierId); } catch { /* The destination reloads canonical rows. */ }
        router.replace(paymentDetailsRoute(resource.weddingId, supplierId, paymentId));
      } catch (failure) {
        if (failure && typeof failure === "object" && "code" in failure && failure.code === "PENDING_PAYMENT_EXISTS") {
          const stored = await readPendingSupplierPayment(userId);
          setAttemptState(stored.kind === "pending" ? { kind: "pending", attempt: stored.attempt, persisted: true } : stored);
        } else if (isDefinitivePaymentRejection(failure)) {
          try { await clearPendingSupplierPayment(attempt); } catch { /* A replay after this rejection remains safe. */ }
          setAttemptState({ kind: "empty" });
          setError(safeSupplierPaymentError(failure));
        } else {
          setAttemptState({ kind: "pending", attempt, persisted: hasPersistedAttempt });
          setError(safeSupplierPaymentError(failure));
        }
      } finally {
        setSaving(false);
      }
    });
  };

  const submit = async () => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      if (pending) {
        if (pendingMatches) await sendAttempt(pending, attemptState.kind === "pending" && attemptState.persisted);
        return;
      }
      setError(null);
      const validation = validatePaymentDraft(draftValue, { installments: data.installments, budgetItems: data.budgetItems });
      if (!validation.ok) { setFieldError(validation.message); return; }
      setFieldError(null);
      const attempt = createPendingSupplierPayment(
        validation.value,
        { userId, weddingId: resource.weddingId, supplierId },
        () => Crypto.randomUUID(),
        () => new Date().toISOString(),
      );
      setAttemptState({ kind: "pending", attempt, persisted: false });
      await sendAttempt(attempt, false);
    } finally {
      actionInProgress.current = false;
    }
  };

  if (attemptState.kind === "unreadable") {
    return <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Payment Schedule" variant="text" onPress={back} />
      <EmptyState title="Payment retry needs review" description="A saved payment attempt could not be read. It was kept on this device, and no new payment can be started until it is recovered." />
    </KatipanScreen>;
  }
  if (pending && !pendingMatches) {
    return <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Payment Schedule" variant="text" onPress={back} />
      <EditorialCard style={styles.pendingCard}>
        <KatipanText variant="headlineSmall">A different payment needs a safe retry</KatipanText>
        <KatipanText color="textMuted">Finish that saved payment with its original request key and facts before starting another one.</KatipanText>
        <KatipanButton label="Open the saved payment" onPress={() => router.push(newPaymentRoute(pending.weddingId, pending.supplierId, pending.installmentId))} />
      </EditorialCard>
    </KatipanScreen>;
  }

  const installmentOptions: SelectOption[] = [
    { value: "", label: "Choose an installment", detail: "Select an active scheduled installment." },
    { value: "__unscheduled__", label: "Outside the installment schedule", detail: "Use only for a real Supplier payment that was not scheduled." },
    ...data.installments.filter((item) => item.status !== "CANCELLED").map((item) => ({
      value: item.id,
      label: `${displayDate(item.dueDate)} · ${formatCurrency(item.amount, data.currencyCode)}`,
      detail: `${installmentStatusLabel(item.status)} · unpaid ${formatCurrency(item.unpaidBalance, data.currencyCode)}`,
    })),
  ];
  const budgetOptions: SelectOption[] = [
    { value: "", label: "No linked Budget Item", detail: "The actual payment stays at Supplier level." },
    ...data.budgetItems.map((item) => ({ value: item.id, label: item.name })),
  ];
  const installmentChoiceValue = draftValue.targetChoice === "UNSCHEDULED"
    ? "__unscheduled__"
    : draftValue.targetChoice === "INSTALLMENT" ? draftValue.installmentId ?? "" : "";

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Payment Schedule" variant="text" onPress={back} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">{data.supplier.category.toLocaleUpperCase()}</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">Record Payment</KatipanText>
        <KatipanText color="textMuted">{data.supplier.name} · actual Supplier spending</KatipanText>
      </View>
      {pending ? (
        <>
          <KatipanText accessibilityRole="alert" color="secondary">
            The previous response was not confirmed. Retry sends the same request key, paid date, amount and payment facts.
          </KatipanText>
          <PendingPaymentSummary attempt={pending} schedule={data} />
          {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
          <KatipanButton label="Retry same payment" loading={saving} disabled={saving} onPress={() => void submit()} />
        </>
      ) : (
        <EditorialCard style={styles.formCard}>
          <FormField
            label="Payment amount"
            value={draftValue.amount}
            onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))}
            keyboardType="decimal-pad"
            editable={!saving}
            placeholder="0.00"
            hint={`Enter a positive amount in ${data.currencyCode}. Partial payments are allowed.`}
            error={fieldError?.toLocaleLowerCase().includes("amount") ? fieldError : undefined}
          />
          <DateTimeField
            label="Paid at"
            value={draftValue.paidAt}
            disabled={saving}
            onChange={(paidAt) => setDraft((current) => ({ ...current, paidAt }))}
          />
          <KatipanText variant="bodySmall" color="textMuted">If you leave this blank, the payment action records the current time once and reuses it on every retry.</KatipanText>
          <PaymentSelectField
            label="Payment schedule"
            value={installmentChoiceValue}
            options={installmentOptions}
            disabled={saving}
            hint="Choose an active installment or explicitly confirm that this payment is unscheduled."
            onChange={(value) => {
              if (value === "__unscheduled__") {
                setDraft((current) => ({ ...current, targetChoice: "UNSCHEDULED", installmentId: null }));
              } else if (value) {
                const selected = data.installments.find((item) => item.id === value) ?? null;
                setDraft((current) => ({
                  ...current,
                  targetChoice: "INSTALLMENT",
                  installmentId: selected?.id ?? null,
                  budgetItemId: selected?.budgetItemId ?? current.budgetItemId,
                }));
              } else {
                setDraft((current) => ({ ...current, targetChoice: "UNSELECTED", installmentId: null }));
              }
            }}
          />
          <PaymentSelectField
            label="Budget Item"
            value={draftValue.budgetItemId ?? ""}
            options={budgetOptions}
            disabled={saving}
            hint="Optional. Only Budget Items linked to this Supplier are shown."
            onChange={(budgetItemId) => setDraft((current) => ({ ...current, budgetItemId: budgetItemId || null }))}
          />
          <FormField
            label="Payment method"
            value={draftValue.paymentMethod}
            onChangeText={(paymentMethod) => setDraft((current) => ({ ...current, paymentMethod }))}
            editable={!saving}
            placeholder="Bank transfer, cash, cheque…"
          />
          <FormField
            label="Reference number"
            value={draftValue.referenceNumber}
            onChangeText={(referenceNumber) => setDraft((current) => ({ ...current, referenceNumber }))}
            editable={!saving}
            placeholder="Optional transfer or receipt reference"
          />
          <FormField
            label="Payment notes"
            value={draftValue.notes}
            onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))}
            editable={!saving}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.notesInput}
            placeholder="Add context for this actual payment"
          />
          {!!fieldError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{fieldError}</KatipanText>}
          {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
          <KatipanButton label="Record Payment" loading={saving} disabled={saving} onPress={() => void submit()} />
          <KatipanText variant="bodySmall" color="textMuted">Submitting creates one immutable payment action. If its response is unclear, the same request is kept for an exact retry.</KatipanText>
        </EditorialCard>
      )}
    </KatipanScreen>
  );
}

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer> {
  if (asset.file) return asset.file.arrayBuffer();
  return new File(asset.uri).arrayBuffer();
}

function receiptContentType(asset: DocumentPicker.DocumentPickerAsset): string {
  if (asset.mimeType?.trim()) return asset.mimeType.trim();
  if (asset.name.toLocaleLowerCase().endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export function SupplierPaymentDetailsScreen() {
  const params = useLocalSearchParams<{ supplierId?: string | string[]; paymentId?: string | string[] }>();
  const supplierId = routeParam(params.supplierId);
  const paymentId = routeParam(params.paymentId);
  const router = useRouter();
  const resource = useSupplierPaymentDetailsResource(supplierId, paymentId);
  const [reversalReason, setReversalReason] = useState("");
  const [confirmReversal, setConfirmReversal] = useState(false);
  const [reversalSaving, setReversalSaving] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [deleteReceiptId, setDeleteReceiptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(new SupplierSubmitGate());

  if (!supplierId || !paymentId) return <KatipanScreen><ErrorState title="Payment unavailable" description="This payment isn't available in the selected Wedding." onRetry={() => router.back()} /></KatipanScreen>;
  if (resource.loading || (resource.membership && !resource.isCurrent)) return <KatipanScreen><LoadingState label="Loading payment details…" /></KatipanScreen>;
  if (!resource.membership || !resource.isCurrent) return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  if (resource.error || !resource.data) return <KatipanScreen><ErrorState title="Payment unavailable" description="We couldn't load this payment. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) return <FinancePrivate onBack={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} />;
  if (resource.data.kind === "unavailable") return <KatipanScreen><ErrorState title="Payment unavailable" description="This payment isn't available in the selected Wedding." onRetry={() => router.replace(supplierPaymentsRoute(resource.weddingId, supplierId))} /></KatipanScreen>;

  const { supplier, payment, installment, budgetItem, reversal, receipts, currencyCode } = resource.data.data;
  const goBack = () => router.canGoBack() ? router.back() : router.replace(supplierPaymentsRoute(resource.weddingId, supplierId));

  const reverse = async () => {
    if (!reversalReason.trim()) {
      setError("Enter a non-empty reversal reason.");
      return;
    }
    await gate.current.run(async () => {
      setReversalSaving(true);
      setError(null);
      try {
        await reverseSupplierPayment(resource.membership!, supplierId, paymentId, reversalReason);
        setConfirmReversal(false);
        setReversalReason("");
        try {
          await refreshSupplierFinanceAggregates(resource.membership!, supplierId);
        } catch {
          setError("The reversal was recorded. Refresh Payment Details to see the latest finance totals.");
        }
        resource.retry();
      } catch (failure) {
        setError(safeReversalError(failure));
      } finally {
        setReversalSaving(false);
      }
    });
  };

  const uploadReceipt = async () => {
    await gate.current.run(async () => {
      setReceiptSaving(true);
      setError(null);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset) throw new Error("The selected receipt was unavailable.");
        const bytes = await readPickedFile(asset);
        await uploadSupplierPaymentReceipt(resource.membership!, supplierId, paymentId, {
          name: asset.name,
          contentType: receiptContentType(asset),
          bytes,
        });
        resource.retry();
      } catch (failure) {
        setError(safeReceiptError(failure));
      } finally {
        setReceiptSaving(false);
      }
    });
  };

  const openReceipt = async (attachmentId: string) => {
    setError(null);
    try {
      const signedUrl = await openSupplierPaymentReceipt(resource.membership!, supplierId, paymentId, attachmentId);
      await Linking.openURL(signedUrl);
    } catch (failure) {
      setError(safeReceiptError(failure));
    }
  };

  const removeReceipt = async (attachmentId: string) => {
    await gate.current.run(async () => {
      setReceiptSaving(true);
      setError(null);
      try {
        await deleteSupplierPaymentReceipt(resource.membership!, supplierId, paymentId, attachmentId);
        setDeleteReceiptId(null);
        resource.retry();
      } catch (failure) {
        setError(safeReceiptError(failure));
      } finally {
        setReceiptSaving(false);
      }
    });
  };

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Back to Payment Schedule" variant="text" onPress={goBack} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">PAYMENT DETAILS</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{formatCurrency(payment.amount, currencyCode)}</KatipanText>
        <KatipanText color="textMuted">Paid {displayTimestamp(payment.paid_at)}</KatipanText>
        {reversal && <StatusChip label="Reversed" tone="error" />}
      </View>

      {reversal && <EditorialCard style={styles.reversalCard}>
        <KatipanText variant="headlineSmall">This payment was reversed</KatipanText>
        <DetailLine label="Reversed at" value={displayTimestamp(reversal.paid_at)} />
        <DetailLine label="Reversal amount" value={formatCurrency(reversal.amount, currencyCode)} />
        <DetailLine label="Reason" value={reversal.notes ?? "Reason not recorded"} />
      </EditorialCard>}

      <EditorialCard style={styles.detailCard}>
        <SectionHeader title="Payment record" description="This transaction is immutable. Corrections are recorded as a separate payment or reversal." />
        <DetailLine label="Supplier" value={supplier.name} />
        {installment && <DetailLine label="Installment" value={`${displayDate(installment.dueDate)} · ${formatCurrency(installment.amount, currencyCode)} (${installmentStatusLabel(installment.status)})`} />}
        {!installment && <DetailLine label="Installment" value="Outside schedule (unscheduled)" />}
        {budgetItem && <DetailLine label="Budget Item" value={budgetItem.name} />}
        {!budgetItem && <DetailLine label="Budget Item" value="Not linked" />}
        <DetailLine label="Payment method" value={payment.payment_method ?? "Not provided"} />
        <DetailLine label="Reference number" value={payment.reference_number ?? "Not provided"} />
        <DetailLine label="Notes" value={payment.notes ?? "No notes"} />
      </EditorialCard>

      <View style={styles.section}>
        <SectionHeader title="Receipt evidence" description="Private files are available only to finance-authorized Wedding members." action={<KatipanButton label="Add Receipt" variant="text" loading={receiptSaving} onPress={() => void uploadReceipt()} />} />
        {receipts.length === 0 ? (
          <EditorialCard style={styles.emptyCard}>
            <EmptyState title="No receipt attached" description="Upload a receipt image or PDF as private evidence for this payment." action={<KatipanButton label="Upload Receipt" loading={receiptSaving} onPress={() => void uploadReceipt()} />} />
          </EditorialCard>
        ) : receipts.map((receipt) => (
          <EditorialCard key={receipt.id} style={styles.receiptCard}>
            <View style={styles.cardHeading}>
              <View style={styles.grow}>
                <KatipanText variant="title">{receipt.original_filename}</KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">{receipt.content_type}{displaySize(receipt.size_bytes) ? ` · ${displaySize(receipt.size_bytes)}` : ""}</KatipanText>
              </View>
              <StatusChip label="Private" tone="neutral" />
            </View>
            <View style={styles.inlineActions}>
              <KatipanButton label="Open receipt" variant="secondary" disabled={receiptSaving} onPress={() => void openReceipt(receipt.id)} />
              <KatipanButton label={deleteReceiptId === receipt.id ? "Keep receipt" : "Remove receipt"} variant="text" disabled={receiptSaving} onPress={() => setDeleteReceiptId((current) => current === receipt.id ? null : receipt.id)} />
            </View>
            {deleteReceiptId === receipt.id && <EditorialCard style={styles.confirmCard}>
              <KatipanText variant="title">Remove this receipt?</KatipanText>
              <KatipanText color="textMuted">This marks the Attachment deleted. It remains in the audit history and is no longer available to open.</KatipanText>
              <KatipanButton label="Confirm receipt removal" loading={receiptSaving} disabled={receiptSaving} onPress={() => void removeReceipt(receipt.id)} />
            </EditorialCard>}
          </EditorialCard>
        ))}
        {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Reverse payment" description="A reversal adds a matching ledger row and preserves this original payment." />
        {reversal ? (
          <EditorialCard style={styles.emptyCard}><KatipanText color="textMuted">This payment already has its one reversal.</KatipanText></EditorialCard>
        ) : confirmReversal ? (
          <EditorialCard style={styles.formCard}>
            <KatipanText variant="title">Confirm this reversal</KatipanText>
            <KatipanText color="textMuted">The original payment will remain unchanged. A new reversal transaction will be added.</KatipanText>
            <FormField
              label="Reason for reversal"
              value={reversalReason}
              onChangeText={setReversalReason}
              editable={!reversalSaving}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.notesInput}
              placeholder="Add a clear reason"
              error={!reversalReason.trim() && !!error ? "Enter a non-empty reversal reason." : undefined}
            />
            <View style={styles.inlineActions}>
              <KatipanButton label="Keep payment" variant="secondary" disabled={reversalSaving} onPress={() => { setConfirmReversal(false); setError(null); }} />
              <KatipanButton label="Confirm reversal" variant="text" loading={reversalSaving} disabled={reversalSaving || !reversalReason.trim()} onPress={() => void reverse()} />
            </View>
            {!!error && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{error}</KatipanText>}
            <KatipanText variant="bodySmall" color="textMuted">A reversal timeout cannot be safely replayed. Refresh these details and check for a reversal before trying again.</KatipanText>
          </EditorialCard>
        ) : (
          <EditorialCard style={styles.formCard}>
            <KatipanText color="textMuted">Reversing adds one append-only REVERSAL with the same amount, installment and Budget Item.</KatipanText>
            <KatipanButton label="Start reversal" variant="secondary" disabled={reversalSaving} onPress={() => { setError(null); setConfirmReversal(true); }} />
          </EditorialCard>
        )}
      </View>
    </KatipanScreen>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}>
    <KatipanText variant="labelCaps" color="secondary">{label}</KatipanText>
    <KatipanText variant="title">{value}</KatipanText>
  </View>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailLine}>
    <KatipanText variant="label" color="textMuted">{label}</KatipanText>
    <KatipanText style={styles.detailValue}>{value}</KatipanText>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  titleBlock: { gap: s.small },
  backButton: { alignSelf: "flex-start" },
  section: { gap: s.medium },
  formCard: { gap: s.medium },
  totalsCard: { gap: s.medium, backgroundColor: c.pearlIvory },
  installmentCard: { gap: s.medium },
  paymentRow: { gap: s.medium },
  receiptCard: { gap: s.medium },
  detailCard: { gap: s.medium },
  reversalCard: { gap: s.medium, borderColor: c.error },
  pendingCard: { gap: s.medium, backgroundColor: c.surfaceLow },
  emptyCard: { padding: 0 },
  confirmCard: { gap: s.medium, backgroundColor: c.surfaceLow },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", gap: s.medium },
  grow: { flex: 1, gap: s.micro },
  metricLine: { flexDirection: "row", flexWrap: "wrap", gap: s.medium },
  metric: { minWidth: 100, flex: 1, gap: s.micro },
  detailLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: s.medium },
  detailValue: { flex: 1, textAlign: "right" },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  formActions: { gap: s.small },
  notesInput: { minHeight: 104, paddingTop: s.medium },
  field: { gap: s.small },
  selectField: { minHeight: 56, justifyContent: "center", gap: s.micro, paddingHorizontal: s.medium, paddingVertical: s.small, borderRadius: r.medium, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.cardIvory },
  disabled: { opacity: 0.55 },
  modalShell: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "#00000055" },
  modalSheet: { maxHeight: "78%", gap: s.medium, backgroundColor: c.surfaceLowest, borderTopLeftRadius: r.large, borderTopRightRadius: r.large, padding: s.medium, paddingBottom: s.large },
  optionList: { flexGrow: 0 },
  option: { gap: s.micro, padding: s.medium, borderBottomWidth: 1, borderBottomColor: c.stoneBorder },
  optionSelected: { backgroundColor: c.surfaceLow, borderRadius: r.medium },
});
