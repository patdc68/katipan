import { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { deleteStylingColor, readPickedImage, reorderStylingColors, saveStylingColor, unlinkStylingInspiration, uploadStylingInspiration } from "./api";
import {
  colorContradictions,
  moveId,
  orderedColors,
  safeStylingError,
  StylingSubmitGate,
  type ColorCollectionRef,
  type StylingColor,
  type StylingImage,
} from "./model";
import type { WorkspaceMembership } from "../workspace/model";
import { EditorialCard, FormField, KatipanButton, KatipanText, StatusChip } from "../ui";

export function ColorCollectionEditor({
  title,
  description,
  collection,
  rows,
  membership,
  canEdit,
  onChanged,
}: {
  title: string;
  description: string;
  collection: ColorCollectionRef;
  rows: readonly StylingColor[];
  membership: WorkspaceMembership;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const gate = useRef(new StylingSubmitGate());
  const [colorHex, setColorHex] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = orderedColors(rows);
  const editing = ordered.find((row) => row.id === editingId);

  const resetEditor = () => { setColorHex(""); setName(""); setEditingId(null); setError(null); };
  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        done?.();
        onChanged();
      } catch (cause) {
        setError(safeStylingError(cause));
      } finally {
        setBusy(false);
      }
    });
  };

  const beginEdit = (color: StylingColor) => {
    setEditingId(color.id);
    setColorHex(color.color_hex);
    setName(color.name ?? "");
    setError(null);
  };
  const save = () => run(() => saveStylingColor(membership, collection, { colorHex, name }, editingId ?? undefined), resetEditor);
  const remove = (colorId: string) => run(() => deleteStylingColor(membership, collection, colorId), () => setConfirmingDeleteId(null));
  const move = (colorId: string, direction: -1 | 1) => {
    const ids = moveId(ordered, colorId, direction);
    if (ids.every((id, index) => id === ordered[index]?.id)) return;
    run(() => reorderStylingColors(membership, collection, ordered, ids));
  };

  return (
    <EditorialCard style={styles.collectionCard}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <KatipanText variant="title">{title}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{description}</KatipanText>
        </View>
        <StatusChip label={`${ordered.length} ${ordered.length === 1 ? "color" : "colors"}`} />
      </View>
      {ordered.length === 0 ? <KatipanText color="textMuted">No colors have been added.</KatipanText> : (
        <View style={styles.colorList}>
          {ordered.map((color, index) => (
            <View key={color.id} style={styles.colorRow}>
              <View style={[styles.swatch, { backgroundColor: color.color_hex }]} accessibilityLabel={`Color ${color.name ?? color.color_hex}`} />
              <View style={styles.colorCopy}>
                <KatipanText variant="labelLarge">{color.name || color.color_hex}</KatipanText>
                <KatipanText variant="bodySmall" color="textMuted">{color.color_hex}</KatipanText>
              </View>
              {canEdit && <View style={styles.rowActions}>
                <SmallAction label="Move up" disabled={busy || index === 0} onPress={() => move(color.id, -1)} />
                <SmallAction label="Move down" disabled={busy || index === ordered.length - 1} onPress={() => move(color.id, 1)} />
                <SmallAction label="Edit" disabled={busy} onPress={() => beginEdit(color)} />
                <SmallAction label="Remove" disabled={busy} onPress={() => { setConfirmingDeleteId(color.id); setError(null); }} />
              </View>}
              {confirmingDeleteId === color.id && canEdit && (
                <View style={styles.confirmBox}>
                  <KatipanText variant="bodySmall">Remove {color.name || color.color_hex} from this collection?</KatipanText>
                  <View style={styles.confirmActions}>
                    <KatipanButton label="Keep color" variant="text" disabled={busy} onPress={() => setConfirmingDeleteId(null)} />
                    <KatipanButton label="Remove color" variant="secondary" loading={busy} onPress={() => remove(color.id)} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {canEdit && (
        <View style={styles.editor}>
          <FormField label={editing ? "Color hex" : "Add a color hex"} value={colorHex} onChangeText={setColorHex}
            autoCapitalize="characters" autoCorrect={false} placeholder="#60725A" maxLength={7}
            accessibilityHint="Enter six hexadecimal digits. The saved value is normalized to uppercase." />
          <FormField label="Color name (optional)" value={name} onChangeText={setName} placeholder="Sage" maxLength={80} />
          <View style={styles.confirmActions}>
            {editing && <KatipanButton label="Cancel edit" variant="text" disabled={busy} onPress={resetEditor} />}
            <KatipanButton label={editing ? "Save color" : "Add color"} loading={busy} onPress={save} />
          </View>
        </View>
      )}
      {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
    </EditorialCard>
  );
}

export function ColorConflictNotice({ recommended, avoid }: { recommended: readonly StylingColor[]; avoid: readonly StylingColor[] }) {
  const conflicts = colorContradictions(recommended, avoid);
  if (conflicts.length === 0) return null;
  return (
    <View style={styles.conflictBox} accessibilityRole="alert">
      <KatipanText variant="labelLarge" color="secondary">Review overlapping guidance</KatipanText>
      <KatipanText variant="bodySmall" color="textMuted">{conflicts.join(", ")} appears in both recommended and avoid colors. The lists remain separate; adjust them if this overlap is unintended.</KatipanText>
    </View>
  );
}

export function InspirationGallery({
  title,
  description,
  source,
  parentId,
  images,
  membership,
  canEdit,
  onChanged,
}: {
  title: string;
  description: string;
  source: "MOTIF" | "DRESS_CODE" | "ATTIRE_GROUP";
  parentId: string;
  images: readonly StylingImage[];
  membership: WorkspaceMembership;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const gate = useRef(new StylingSubmitGate());
  const [visibility, setVisibility] = useState<"GUEST_VISIBLE" | "WEDDING_MEMBER_PRIVATE">("WEDDING_MEMBER_PRIVATE");
  const [confirmingAttachmentId, setConfirmingAttachmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (operation: () => Promise<void>, done?: () => void) => {
    void gate.current.run(async () => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        done?.();
        onChanged();
      } catch (cause) {
        setError(safeStylingError(cause));
      } finally {
        setBusy(false);
      }
    });
  };

  const chooseImage = () => run(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const contentType = (asset.mimeType ?? imageTypeFromName(asset.name)).toLowerCase();
    const bytes = await readPickedImage(asset.uri);
    await uploadStylingInspiration(membership, source, parentId, { name: asset.name, contentType, bytes }, visibility);
  });
  const removeImage = (attachmentId: string) => run(
    () => unlinkStylingInspiration(membership, source, parentId, attachmentId),
    () => setConfirmingAttachmentId(null),
  );

  return (
    <EditorialCard style={styles.collectionCard}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <KatipanText variant="title">{title}</KatipanText>
          <KatipanText variant="bodySmall" color="textMuted">{description}</KatipanText>
        </View>
        <StatusChip label={`${images.length} ${images.length === 1 ? "image" : "images"}`} />
      </View>
      {images.length === 0 ? <KatipanText color="textMuted">No inspiration images yet.</KatipanText> : (
        <View style={styles.imageList}>
          {images.map((item) => (
            <View key={item.attachment.id} style={styles.imageCard}>
              {item.signedUrl
                ? <Image source={{ uri: item.signedUrl }} resizeMode="cover" accessibilityLabel={item.attachment.original_filename} style={styles.image} />
                : <View style={[styles.image, styles.imageUnavailable]}><KatipanText variant="bodySmall" color="textMuted">Image unavailable</KatipanText></View>}
              <View style={styles.imageMeta}>
                <KatipanText variant="labelLarge" numberOfLines={1}>{item.attachment.original_filename}</KatipanText>
                <StatusChip label={item.attachment.visibility === "GUEST_VISIBLE" ? "Guest Guide" : "Planner only"}
                  tone={item.attachment.visibility === "GUEST_VISIBLE" ? "success" : "neutral"} />
                {canEdit && <SmallAction label="Remove inspiration" disabled={busy} onPress={() => { setConfirmingAttachmentId(item.attachment.id); setError(null); }} />}
                {confirmingAttachmentId === item.attachment.id && canEdit && (
                  <View style={styles.confirmBox}>
                    <KatipanText variant="bodySmall">Unlink this image from {title}? The Wedding Attachment stays available for any other links or later reuse.</KatipanText>
                    <View style={styles.confirmActions}>
                      <KatipanButton label="Keep image" variant="text" disabled={busy} onPress={() => setConfirmingAttachmentId(null)} />
                      <KatipanButton label="Unlink image" variant="secondary" loading={busy} onPress={() => removeImage(item.attachment.id)} />
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      {canEdit && <View style={styles.visibilityControls}>
        <KatipanText variant="labelLarge">Image audience</KatipanText>
        <View style={styles.choiceRow}>
          <Choice label="Planner only" selected={visibility === "WEDDING_MEMBER_PRIVATE"} onPress={() => setVisibility("WEDDING_MEMBER_PRIVATE")} />
          <Choice label="Show in Guest Guide" selected={visibility === "GUEST_VISIBLE"} onPress={() => setVisibility("GUEST_VISIBLE")} />
        </View>
        <KatipanText variant="bodySmall" color="textMuted">Only Guest-visible, available images appear in the sanitized Guest Guide.</KatipanText>
        <KatipanButton label="Add inspiration image" variant="secondary" loading={busy} onPress={chooseImage} />
      </View>}
      {!!error && <KatipanText accessibilityRole="alert" color="error">{error}</KatipanText>}
    </EditorialCard>
  );
}

export function SelectionRow({ label, detail, selected, disabled, onPress }: {
  label: string; detail?: string; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.selectionRow, selected && styles.selectionRowSelected, disabled && styles.disabled]}>
      <View style={[styles.checkMark, selected && styles.checkMarkSelected]}>{selected && <KatipanText variant="labelLarge" color="onPrimary">✓</KatipanText>}</View>
      <View style={styles.selectionCopy}>
        <KatipanText variant="labelLarge">{label}</KatipanText>
        {!!detail && <KatipanText variant="bodySmall" color="textMuted">{detail}</KatipanText>}
      </View>
    </Pressable>
  );
}

function SmallAction({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.smallAction, pressed && styles.smallActionPressed, disabled && styles.disabled]}>
      <KatipanText variant="label" color={disabled ? "outline" : "primary"}>{label}</KatipanText>
    </Pressable>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <KatipanText variant="label" color={selected ? "primary" : "textMuted"}>{label}</KatipanText>
    </Pressable>
  );
}

function imageTypeFromName(name: string): string {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

const styles = StyleSheet.create({
  collectionCard: { gap: s.medium },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: s.medium },
  headingCopy: { flex: 1, gap: s.micro },
  colorList: { gap: s.small },
  colorRow: { flexDirection: "row", alignItems: "center", gap: s.small, flexWrap: "wrap", paddingVertical: s.small, borderBottomWidth: 1, borderBottomColor: c.outlineSubtle },
  swatch: { width: 36, height: 36, borderRadius: r.pill, borderWidth: 1, borderColor: c.stoneBorder },
  colorCopy: { flex: 1, minWidth: 100, gap: 2 },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 2, justifyContent: "flex-end" },
  smallAction: { minHeight: 40, paddingHorizontal: s.small, justifyContent: "center", borderRadius: r.pill },
  smallActionPressed: { backgroundColor: c.surfaceLow },
  disabled: { opacity: 0.5 },
  editor: { gap: s.medium, paddingTop: s.medium, borderTopWidth: 1, borderTopColor: c.outlineSubtle },
  confirmBox: { width: "100%", gap: s.small, padding: s.medium, backgroundColor: c.surfaceLow, borderRadius: r.medium },
  confirmActions: { flexDirection: "row", flexWrap: "wrap", gap: s.small, alignItems: "center", justifyContent: "flex-end" },
  conflictBox: { gap: s.small, padding: s.medium, borderWidth: 1, borderColor: c.secondaryContainer, backgroundColor: c.surfaceLow, borderRadius: r.medium },
  imageList: { gap: s.medium },
  imageCard: { overflow: "hidden", borderRadius: r.large, borderWidth: 1, borderColor: c.stoneBorder, backgroundColor: c.surfaceLowest },
  image: { width: "100%", aspectRatio: 4 / 3, backgroundColor: c.surfaceContainer },
  imageUnavailable: { alignItems: "center", justifyContent: "center" },
  imageMeta: { gap: s.small, padding: s.medium },
  visibilityControls: { gap: s.small, paddingTop: s.medium, borderTopWidth: 1, borderTopColor: c.outlineSubtle },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: s.small },
  choice: { minHeight: 44, justifyContent: "center", paddingHorizontal: s.medium, paddingVertical: s.small, borderWidth: 1, borderColor: c.stoneBorder, borderRadius: r.pill },
  choiceSelected: { borderColor: c.primaryContainer, backgroundColor: c.surfaceLow },
  selectionRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: s.medium, padding: s.medium, borderRadius: r.medium, backgroundColor: c.surfaceLowest, borderWidth: 1, borderColor: c.stoneBorder },
  selectionRowSelected: { backgroundColor: c.surfaceLow, borderColor: c.primaryContainer },
  checkMark: { width: 24, height: 24, borderRadius: r.pill, borderWidth: 1, borderColor: c.outlineSubtle, alignItems: "center", justifyContent: "center" },
  checkMarkSelected: { backgroundColor: c.primaryContainer, borderColor: c.primaryContainer },
  selectionCopy: { flex: 1, gap: 2 },
});
