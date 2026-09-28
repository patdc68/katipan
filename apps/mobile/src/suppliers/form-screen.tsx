import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
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
import { createSupplier, updateSupplier } from "./api";
import {
  isSupplierFinanceManager,
  safeSupplierError,
  SupplierSubmitGate,
  supplierStatusLabel,
  supplierStatusTone,
  SUPPLIER_STATUSES,
  validateSupplierDraft,
  type SupplierDraft,
  type SupplierDraftField,
} from "./model";
import { useSupplierEditorResource } from "./use-supplier-resource";

function detailRoute(weddingId: string, supplierId: string): Href {
  return {
    pathname: "/(wedding)/[weddingId]/budget/suppliers/[supplierId]",
    params: { weddingId, supplierId },
  } as unknown as Href;
}

function listRoute(weddingId: string): Href {
  return { pathname: "/(wedding)/[weddingId]/budget/suppliers", params: { weddingId } } as unknown as Href;
}

function paramId(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() || null;
}

const blankDraft: SupplierDraft = {
  name: "",
  category: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
  status: "PROSPECT",
};

export function SupplierFormScreen() {
  const params = useLocalSearchParams<{ supplierId?: string | string[] }>();
  const supplierId = paramId(params.supplierId);
  const router = useRouter();
  const resource = useSupplierEditorResource(supplierId);
  const gate = useRef(new SupplierSubmitGate());
  const hydratedKey = useRef<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(blankDraft);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SupplierDraftField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadedSupplier = resource.data?.kind === "ready" ? resource.data.data.supplier : null;
  useEffect(() => {
    if (resource.data?.kind !== "ready") return;
    const supplier = resource.data.data.supplier;
    const key = `${supplierId ?? "new"}:${supplier?.updated_at ?? ""}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    setDraft(supplier ? {
      name: supplier.name,
      category: supplier.category,
      contactName: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      website: supplier.website ?? "",
      notes: supplier.notes ?? "",
      status: supplier.status,
    } : blankDraft);
  }, [resource.data, supplierId]);

  if (resource.loading || (resource.membership && !resource.isCurrent)) {
    return <KatipanScreen><LoadingState label={supplierId ? "Loading Supplier…" : "Preparing Supplier form…"} /></KatipanScreen>;
  }
  if (!resource.membership || !resource.isCurrent) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }
  if (resource.error || !resource.data) {
    return <KatipanScreen><ErrorState title="Supplier form unavailable" description="We couldn't load this Supplier. Check your connection and try again." onRetry={resource.retry} /></KatipanScreen>;
  }
  if (resource.data.kind === "private" || !isSupplierFinanceManager(resource.membership)) {
    return <KatipanScreen><EmptyState title="Supplier finance is private" description="Only Wedding Owners and Full Coordinators can add or edit Suppliers." action={<KatipanButton label="Back to Budget" variant="secondary" onPress={() => router.back()} />} /></KatipanScreen>;
  }
  if (resource.data.kind === "unavailable" || (supplierId && !loadedSupplier)) {
    return <KatipanScreen><ErrorState title="Supplier unavailable" description="This Supplier isn't available in the selected Wedding." onRetry={resource.retry} /></KatipanScreen>;
  }

  const clearFieldError = (field: SupplierDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
  };

  const save = async () => {
    setSaveError(null);
    const validation = validateSupplierDraft(draft);
    if (!validation.ok) {
      setFieldErrors({ [validation.field]: validation.message });
      return;
    }
    setFieldErrors({});
    await gate.current.run(async () => {
      setSaving(true);
      try {
        const savedId = supplierId
          ? await updateSupplier(resource.membership!, supplierId, draft)
          : await createSupplier(resource.membership!, draft);
        router.replace(detailRoute(resource.weddingId, savedId));
      } catch (failure) {
        const message = safeSupplierError(failure, "We couldn't save this Supplier. Check your connection and try again.");
        setSaveError(message);
        if (failure && typeof failure === "object" && "field" in failure && typeof failure.field === "string") {
          setFieldErrors({ [failure.field as SupplierDraftField]: message });
        }
      } finally {
        setSaving(false);
      }
    });
  };

  const goBack = () => router.canGoBack() ? router.back() : router.replace(listRoute(resource.weddingId));

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <KatipanButton label="Cancel" variant="text" disabled={saving} onPress={goBack} style={styles.backButton} />
      <View style={styles.titleBlock}>
        <KatipanText variant="labelCaps" color="secondary">SUPPLIER DIRECTORY</KatipanText>
        <KatipanText variant="headlineLarge" accessibilityRole="header">{supplierId ? "Edit Supplier" : "Add Supplier"}</KatipanText>
        <KatipanText color="textMuted">Save Supplier details and choose a lifecycle status for this Wedding.</KatipanText>
      </View>

      <EditorialCard style={styles.formCard}>
        <SectionHeader title="Supplier Details" description="Supplier categories are flexible text so your team can organize its own planning needs." />
        <FormField
          label="Supplier name *"
          value={draft.name}
          onChangeText={(value) => clearFieldError("name", value)}
          editable={!saving}
          autoCapitalize="words"
          returnKeyType="next"
          error={fieldErrors.name}
          placeholder="Business or person name"
        />
        <FormField
          label="Category *"
          value={draft.category}
          onChangeText={(value) => clearFieldError("category", value)}
          editable={!saving}
          autoCapitalize="words"
          returnKeyType="next"
          error={fieldErrors.category}
          hint="Add a category such as catering, photography or transport."
          placeholder="Supplier category"
        />
        <FormField
          label="Contact person"
          value={draft.contactName}
          onChangeText={(value) => clearFieldError("contactName", value)}
          editable={!saving}
          autoCapitalize="words"
          returnKeyType="next"
          placeholder="Optional"
        />
        <FormField
          label="Email"
          value={draft.email}
          onChangeText={(value) => clearFieldError("email", value)}
          editable={!saving}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          error={fieldErrors.email}
          placeholder="contact@example.com"
        />
        <FormField
          label="Phone"
          value={draft.phone}
          onChangeText={(value) => clearFieldError("phone", value)}
          editable={!saving}
          keyboardType="phone-pad"
          returnKeyType="next"
          placeholder="Optional"
        />
        <FormField
          label="Website"
          value={draft.website}
          onChangeText={(value) => clearFieldError("website", value)}
          editable={!saving}
          autoCapitalize="none"
          autoComplete="url"
          keyboardType="url"
          returnKeyType="next"
          placeholder="example.com"
        />
        <FormField
          label="Supplier notes"
          value={draft.notes}
          onChangeText={(value) => clearFieldError("notes", value)}
          editable={!saving}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={styles.notesInput}
          placeholder="Add planning details for the team"
        />
      </EditorialCard>

      <EditorialCard style={styles.statusCard}>
        <SectionHeader title="Supplier Status" description="Use one of the five lifecycle statuses in the Supplier record." />
        <View style={styles.statusGrid}>
          {SUPPLIER_STATUSES.map((status) => {
            const selected = draft.status === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="radio"
                accessibilityLabel={supplierStatusLabel(status)}
                accessibilityState={{ selected, disabled: saving }}
                disabled={saving}
                onPress={() => {
                  setDraft((current) => ({ ...current, status }));
                  setFieldErrors((current) => ({ ...current, status: undefined }));
                  setSaveError(null);
                }}
                style={[styles.statusOption, selected && styles.statusOptionSelected, saving && styles.disabled]}
              >
                <StatusChip label={supplierStatusLabel(status)} tone={supplierStatusTone(status)} />
              </Pressable>
            );
          })}
        </View>
        {!!fieldErrors.status && <KatipanText variant="bodySmall" color="error">{fieldErrors.status}</KatipanText>}
      </EditorialCard>

      {!!saveError && <KatipanText variant="bodySmall" color="error" accessibilityRole="alert">{saveError}</KatipanText>}
      <KatipanButton label={supplierId ? "Save Supplier" : "Add Supplier"} loading={saving} disabled={saving} onPress={() => void save()} />
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.extraLarge, paddingBottom: s.extraLarge },
  backButton: { alignSelf: "flex-start" },
  titleBlock: { gap: s.small },
  formCard: { gap: s.medium },
  statusCard: { gap: s.medium },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  statusOption: { minHeight: 48, justifyContent: "center", padding: s.small, borderWidth: 1, borderColor: c.stoneBorder, borderRadius: r.pill, backgroundColor: c.pearlIvory },
  statusOptionSelected: { borderColor: c.primaryContainer, backgroundColor: c.warmAlabaster },
  disabled: { opacity: 0.5 },
  notesInput: { minHeight: 132, paddingTop: s.medium },
});
