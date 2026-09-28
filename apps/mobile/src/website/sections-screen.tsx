import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, FormField, KatipanButton, KatipanScreen, KatipanText, SectionHeader, StatusChip } from "../ui";
import { createCustomSection, deleteCustomSection, ensureStandardSection, moveSection, saveSection } from "./api";
import { WebsiteError, WebsiteGuard, WebsiteHeader, useWebsiteScreen, websiteStyles } from "./components";
import { audiences, standardSections, type Audience, type WebsiteSection } from "./model";

const audienceHelp: Record<Audience, string> = {
  PUBLIC: "Eligible without an invitation when the website allows anyone with the link.",
  INVITED: "Requires a valid invited Household link.",
  PERSONALIZED: "Requires a valid Household link; the guide supplies that Household's projection.",
  HIDDEN: "Never shown to guests.",
};
function SectionEditor({ section, onSave, onMove, onDelete, canManage, busy }: {
  section: WebsiteSection; onSave: (value: { audience: Audience; enabled: boolean; content: string }) => void;
  onMove: (direction: -1 | 1) => void; onDelete: () => void; canManage: boolean; busy: boolean;
}) {
  const [audience, setAudience] = useState<Audience>(section.audience);
  const [enabled, setEnabled] = useState(section.enabled);
  const [content, setContent] = useState(section.content ?? "");
  const title = standardSections.find(row => row.type === section.section_type)?.label ?? section.section_key.replaceAll("_", " ");
  const editableContent = section.section_type === "INTRO" || section.section_type === "CUSTOM";
  return <EditorialCard style={styles.card}>
    <View style={styles.heading}><KatipanText variant="headlineSmall">{title}</KatipanText><StatusChip label={enabled && audience !== "HIDDEN" ? audience : "Hidden"} tone={enabled && audience !== "HIDDEN" ? "success" : "neutral"} /></View>
    <KatipanText variant="bodySmall" color="textMuted">{section.section_type} · Order {section.sort_order}</KatipanText>
    {canManage && <View style={websiteStyles.row}>
      <KatipanButton label={enabled ? "Disable" : "Enable"} variant={enabled ? "secondary" : "primary"} onPress={() => setEnabled(v => !v)} />
      <KatipanButton label="Move up" variant="text" disabled={busy} onPress={() => onMove(-1)} />
      <KatipanButton label="Move down" variant="text" disabled={busy} onPress={() => onMove(1)} />
    </View>}
    <KatipanText variant="labelLarge">Audience</KatipanText>
    <View style={websiteStyles.row}>{audiences.map(value => <KatipanButton key={value} label={value.toLowerCase().replace(/^./, ch => ch.toUpperCase())}
      variant={audience === value ? "primary" : "secondary"} disabled={!canManage || busy} onPress={() => setAudience(value)} />)}</View>
    <KatipanText variant="bodySmall" color="textMuted">{audienceHelp[audience]}</KatipanText>
    {editableContent && <FormField label="Section content" value={content} multiline editable={canManage} onChangeText={setContent} />}
    {!editableContent && <KatipanText variant="bodySmall" color="textMuted">Content comes from the Wedding&apos;s {title} records.</KatipanText>}
    {canManage && <View style={websiteStyles.row}>
      <KatipanButton label="Save section" loading={busy} onPress={() => onSave({ audience, enabled, content })} />
      {section.section_type === "CUSTOM" && <KatipanButton label="Delete custom section" variant="text" disabled={busy} onPress={onDelete} />}
    </View>}
  </EditorialCard>;
}
export default function SectionsScreen() {
  const state = useWebsiteScreen();
  const sections = state.data?.sections ?? [];
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const missing = standardSections.filter(value => !sections.some(row => row.section_type === value.type));
  return <WebsiteGuard state={state}><KatipanScreen contentContainerStyle={websiteStyles.page}>
    <KatipanButton label="Back to Website" variant="text" onPress={() => state.router.back()} />
    <WebsiteHeader title="Sections & Visibility" description="Set each section's place and audience. Disabled and Hidden sections stay out of the guest guide." />
    <EditorialCard style={websiteStyles.notice}><KatipanText variant="labelCaps" color="secondary">GUEST PROJECTION</KatipanText>
      <KatipanText>Places and attire come from guest-visible Wedding data. The Guest Program is projected separately and is not a website section.</KatipanText>
    </EditorialCard>
    {!state.data?.site && <EditorialCard><KatipanText>Create website details first to add sections.</KatipanText></EditorialCard>}
    {state.canManage && state.data?.site && missing.length > 0 && <EditorialCard style={websiteStyles.card}>
      <SectionHeader title="Add a standard section" description="New sections start disabled and hidden." />
      {missing.map(item => <KatipanButton key={item.type} label={`Add ${item.label}`} variant="secondary" loading={state.saving}
        onPress={() => void state.mutate(() => ensureStandardSection(state.membership!, item.key, item.type as Exclude<typeof item.type, "CUSTOM">, sections.length))} />)}
    </EditorialCard>}
    {sections.map(section => <SectionEditor key={`${section.id}:${section.updated_at}`} section={section} canManage={state.canManage} busy={state.saving}
      onSave={value => void state.mutate(() => saveSection(state.membership!, section.id, value))}
      onMove={direction => void state.mutate(() => moveSection(state.membership!, sections, section.id, direction))}
      onDelete={() => setDeleteId(section.id)} />)}
    {state.canManage && state.data?.site && <EditorialCard style={websiteStyles.card}>
      <SectionHeader title="Custom section" description="Use a short key with letters, numbers, and underscores. You can edit its text after adding it." />
      <FormField label="Section key" value={newKey} autoCapitalize="none" onChangeText={setNewKey} />
      <FormField label="Content" value={newContent} multiline onChangeText={setNewContent} />
      <KatipanButton label="Add custom section" loading={state.saving} onPress={() => void state.mutate(async () => {
        await createCustomSection(state.membership!, newKey, newContent, sections.length); setNewKey(""); setNewContent("");
      })} />
    </EditorialCard>}
    {deleteId && <EditorialCard style={styles.confirm}>
      <KatipanText variant="headlineSmall">Delete this custom section?</KatipanText>
      <KatipanText color="textMuted">Its content will be removed from the website.</KatipanText>
      <View style={websiteStyles.row}><KatipanButton label="Keep section" variant="secondary" onPress={() => setDeleteId(null)} />
        <KatipanButton label="Delete section" loading={state.saving} onPress={() => void state.mutate(async () => {
          await deleteCustomSection(state.membership!, deleteId); setDeleteId(null);
        })} /></View>
    </EditorialCard>}
    <WebsiteError message={state.saveError} />
  </KatipanScreen></WebsiteGuard>;
}
const styles = StyleSheet.create({
  card: { gap: s.medium, backgroundColor: c.surfaceLowest },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s.small },
  confirm: { gap: s.medium, borderColor: c.champagne, backgroundColor: c.softBeige },
});
