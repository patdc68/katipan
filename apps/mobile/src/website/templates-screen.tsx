import { StyleSheet, View } from "react-native";
import { colorTokens as c, spacingTokens as s } from "@katipan/ui";
import { EditorialCard, KatipanButton, KatipanScreen, KatipanText, StatusChip } from "../ui";
import { chooseTemplate } from "./api";
import { WebsiteError, WebsiteGuard, WebsiteHeader, useWebsiteScreen, websiteStyles } from "./components";
import { templates, type TemplateKey } from "./model";

const accents: Record<TemplateKey, { background: string; border: string; ink: string }> = {
  SAMPAGUITA: { background: "#FDFBF7", border: "#C5A059", ink: "#485943" },
  LUNTIAN: { background: "#E9EEE5", border: "#60725A", ink: "#314431" },
  FILIPINIANA: { background: "#F7EEDF", border: "#A77734", ink: "#775A19" },
  MODERN_LOVE: { background: "#F4ECE8", border: "#B7A6A0", ink: "#1E1B19" },
  AFTER_DARK: { background: "#242622", border: "#C5A059", ink: "#FFF8F5" },
};
export default function TemplateGalleryScreen() {
  const state = useWebsiteScreen();
  const site = state.data?.site;
  return <WebsiteGuard state={state}><KatipanScreen contentContainerStyle={websiteStyles.page}>
    <KatipanButton label="Back to Website" variant="text" onPress={() => state.router.back()} />
    <WebsiteHeader title="Template Gallery" description="Find the feeling that fits your celebration. Your guest details stay exactly where they are." />
    {!site && <EditorialCard><KatipanText>Create website details first to choose a template.</KatipanText></EditorialCard>}
    {templates.map(template => {
      const palette = accents[template.key];
      const selected = site?.template_key === template.key;
      return <EditorialCard key={template.key} style={[styles.card, selected && styles.selected]}>
        <View style={[styles.sample, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <KatipanText variant="labelCaps" style={{ color: palette.ink }}>KATIPAN · WEDDING WEBSITE</KatipanText>
          <KatipanText variant="headlineMedium" style={{ color: palette.ink }}>{site?.title || "Our Wedding"}</KatipanText>
          <KatipanText variant="bodySmall" style={{ color: palette.ink }}>{template.name}</KatipanText>
        </View>
        <View style={styles.row}><KatipanText variant="headlineSmall">{template.name}</KatipanText>{selected && <StatusChip label="Selected" tone="success" />}</View>
        <KatipanText color="textMuted">{template.description}</KatipanText>
        {state.canManage && site && <KatipanButton label={selected ? "Current template" : `Choose ${template.name}`}
          variant={selected ? "secondary" : "primary"} disabled={selected} loading={state.saving}
          onPress={() => void state.mutate(() => chooseTemplate(state.membership!, template.key))} />}
      </EditorialCard>;
    })}
    <WebsiteError message={state.saveError} />
  </KatipanScreen></WebsiteGuard>;
}
const styles = StyleSheet.create({
  card: { gap: s.medium, backgroundColor: c.surfaceLowest }, selected: { borderColor: c.primary, borderWidth: 2 },
  sample: { minHeight: 190, padding: s.large, borderWidth: 1, borderRadius: 18, justifyContent: "center", alignItems: "center", gap: s.small },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: s.small },
});
