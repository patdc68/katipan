import { useState } from "react";
import { View } from "react-native";
import { EditorialCard, FormField, KatipanButton, KatipanScreen, KatipanText, SectionHeader } from "../ui";
import { saveWebsite } from "./api";
import { WebsiteError, WebsiteGuard, WebsiteHeader, WebsiteNavigation, useWebsiteScreen, websiteStyles } from "./components";
import { type SiteDraft } from "./model";

export default function WebsiteEditorScreen() {
  const state = useWebsiteScreen();
  return <WebsiteGuard state={state}><WebsiteEditorForm key={state.data?.site?.updated_at ?? "new"} state={state} /></WebsiteGuard>;
}
function WebsiteEditorForm({ state }: { state: ReturnType<typeof useWebsiteScreen> }) {
  const site = state.data?.site;
  const [draft, setDraft] = useState<SiteDraft>({ slug: site?.slug ?? "", template_key: site?.template_key ?? "SAMPAGUITA",
    access_mode: site?.access_mode ?? "INVITED_GUESTS_ONLY", title: site?.title ?? "", introduction: site?.introduction ?? "" });
  const [localError, setLocalError] = useState<string | null>(null);
  const save = () => {
    setLocalError(null);
    if (!draft.slug) { setLocalError("Add a website address before saving."); return; }
    if (!state.membership) return;
    void state.mutate(() => saveWebsite(state.membership!, draft, !!site));
  };
  return <KatipanScreen contentContainerStyle={websiteStyles.page}>
    <KatipanButton label="Back to More" variant="text" onPress={() => state.router.back()} />
    <WebsiteHeader title="Your Wedding Website" description="A thoughtful home for your celebration details and guest guide." published={site?.is_published ?? false} />
    <EditorialCard style={websiteStyles.card}>
      <SectionHeader title="Website details" description="The address is unique across Katipan. Publishing is a separate step." />
      <FormField label="Website address" autoCapitalize="none" autoCorrect={false} value={draft.slug} editable={state.canManage}
        onChangeText={slug => setDraft(current => ({ ...current, slug }))} hint="katipan.ph/w/your-address · lowercase letters, numbers and hyphens" />
      <FormField label="Title" value={draft.title} editable={state.canManage} onChangeText={title => setDraft(current => ({ ...current, title }))} />
      <FormField label="Introduction" value={draft.introduction} editable={state.canManage} multiline
        hint="Appears when the Welcome section is enabled for the visitor's audience."
        onChangeText={introduction => setDraft(current => ({ ...current, introduction }))} />
      <KatipanText variant="labelLarge">Who can open the guide?</KatipanText>
      <View style={websiteStyles.row}>
        <KatipanButton label="Anyone with link" variant={draft.access_mode === "ANYONE_WITH_LINK" ? "primary" : "secondary"}
          disabled={!state.canManage} onPress={() => setDraft(current => ({ ...current, access_mode: "ANYONE_WITH_LINK" }))} />
        <KatipanButton label="Invited guests only" variant={draft.access_mode === "INVITED_GUESTS_ONLY" ? "primary" : "secondary"}
          disabled={!state.canManage} onPress={() => setDraft(current => ({ ...current, access_mode: "INVITED_GUESTS_ONLY" }))} />
      </View>
      <KatipanText variant="bodySmall" color="textMuted">Public visitors see only sections eligible without a Household token. A valid invitation is needed for personalized information.</KatipanText>
      {state.canManage && <KatipanButton label={site ? "Save website details" : "Create Wedding website"} loading={state.saving} onPress={save} />}
      {!state.canManage && <KatipanText color="textMuted">Your Wedding role can view this website. An Owner or Full Coordinator manages changes.</KatipanText>}
      <WebsiteError message={localError ?? state.saveError} />
    </EditorialCard>
    <WebsiteNavigation navigate={state.navigate} hasSite={!!site} />
    <EditorialCard style={websiteStyles.notice}><KatipanText variant="labelCaps" color="secondary">INVITATION DELIVERY</KatipanText>
      <KatipanText>Publishing the website never sends invitations or creates Household links. Manage a Household link from Household Details.</KatipanText>
    </EditorialCard>
  </KatipanScreen>;
}
