import { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { EditorialCard, KatipanButton, KatipanScreen, KatipanText, SectionHeader, StatusChip } from "../ui";
import { loadProgram } from "../guest-program/api";
import { setWebsitePublication } from "./api";
import { guestVisibleProgram, type ProgramData } from "../guest-program/model";
import { WebsiteError, WebsiteGuard, WebsiteHeader, useWebsiteScreen, websiteStyles } from "./components";

export default function WebsitePreviewScreen() {
  const state = useWebsiteScreen();
  const site = state.data?.site;
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [program, setProgram] = useState<ProgramData | null>(null);
  const membership = state.membership;
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (membership && state.isCurrent) void loadProgram(membership).then(data => { if (alive) setProgram(data); }).catch(() => { if (alive) setProgram(null); });
    return () => { alive = false; };
  }, [membership, state.isCurrent]));
  const liveUrl = site ? `https://katipan.ph/w/${site.slug}` : null;
  const sections = state.data?.sections ?? [];
  return <WebsiteGuard state={state}><KatipanScreen contentContainerStyle={websiteStyles.page}>
    <KatipanButton label="Back to Website" variant="text" onPress={() => state.router.back()} />
    <WebsiteHeader title="Preview & Publish" description="Review the draft, then decide when the guest website goes live." published={site?.is_published ?? false} />
    {!site && <EditorialCard><KatipanText>Create website details before previewing or publishing.</KatipanText></EditorialCard>}
    {site && <>
      <EditorialCard style={websiteStyles.notice}>
        <StatusChip label="Draft / editor preview" tone="warning" />
        <KatipanText variant="headlineSmall">{site.title || state.membership?.wedding.display_name || "Wedding website"}</KatipanText>
        {!!site.introduction && <KatipanText>{site.introduction}</KatipanText>}
        <KatipanText variant="bodySmall" color="textMuted">This manager preview includes configured sections, even if they are unpublished or hidden. Guests cannot see them until the website and each section allow access.</KatipanText>
        {sections.map(section => <View key={section.id} style={{ gap: 4 }}>
          <KatipanText variant="labelCaps" color="secondary">{section.section_type} · {section.enabled ? section.audience : "DISABLED"}</KatipanText>
          <KatipanText>{section.content || section.section_key.replaceAll("_", " ")}</KatipanText>
        </View>)}
      </EditorialCard>
      <EditorialCard style={websiteStyles.card}>
        <SectionHeader title="Guest Program" description="Only published items appear in the live guide. Draft items remain in the editor." />
        {guestVisibleProgram(program?.items ?? []).map(item => <KatipanText key={item.id}>{item.title}</KatipanText>)}
        {!guestVisibleProgram(program?.items ?? []).length && <KatipanText color="textMuted">No published Guest Program items yet.</KatipanText>}
      </EditorialCard>
      <EditorialCard style={websiteStyles.card}>
        <StatusChip label="Live published guest experience" tone={site.is_published ? "success" : "neutral"} />
        <KatipanText variant="headlineSmall">{liveUrl}</KatipanText>
        <KatipanText color="textMuted">{site.is_published
          ? site.access_mode === "ANYONE_WITH_LINK" ? "Open the live public guide using its real guest access rules." : "The live guide requires a valid Household invitation link. Open a Household's issued link to review personalized access."
          : "This address is unavailable to guests until you publish."}</KatipanText>
        {site.is_published && site.access_mode === "ANYONE_WITH_LINK" && liveUrl && <KatipanButton label="Open live guest guide" variant="secondary" onPress={() => void Linking.openURL(liveUrl)} />}
      </EditorialCard>
      {state.canManage && <EditorialCard style={websiteStyles.card}>
        <SectionHeader title={site.is_published ? "Unpublish website" : "Publish website"}
          description="This changes website availability only. It does not create Household tokens, send invitations, or mark delivery." />
        {confirm === null ? <KatipanButton label={site.is_published ? "Unpublish" : "Publish"}
          variant={site.is_published ? "secondary" : "primary"} onPress={() => setConfirm(!site.is_published)} />
          : <><KatipanText variant="headlineSmall">{confirm ? "Make this website live?" : "Take this website offline?"}</KatipanText>
            <KatipanText color="textMuted">Website details, sections, and Guest Program remain saved.</KatipanText>
            <View style={websiteStyles.row}><KatipanButton label="Cancel" variant="secondary" onPress={() => setConfirm(null)} />
              <KatipanButton label={confirm ? "Confirm publish" : "Confirm unpublish"} loading={state.saving}
                onPress={() => void state.mutate(async () => { await setWebsitePublication(state.membership!, confirm); setConfirm(null); })} /></View></>}
      </EditorialCard>}
    </>}
    <WebsiteError message={state.saveError} />
  </KatipanScreen></WebsiteGuard>;
}
