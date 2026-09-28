import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import { canManageWebsite, orderedSections, sectionDraftSchema, siteDraftSchema,
  type SiteDraft, type WebsiteData, type WebsiteSection, type SectionType } from "./model";

function assertMember(membership: WorkspaceMembership) {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id)
    throw new Error("This Wedding workspace is unavailable.");
}
function assertManager(membership: WorkspaceMembership) {
  assertMember(membership);
  if (!canManageWebsite(membership)) throw new Error("This membership cannot manage the Wedding website.");
}
export async function loadWebsite(membership: WorkspaceMembership): Promise<WebsiteData> {
  assertMember(membership);
  const [site, sections] = await Promise.all([
    supabase.from("wedding_websites").select("*").eq("wedding_id", membership.weddingId).maybeSingle(),
    supabase.from("wedding_website_sections").select("*").eq("wedding_id", membership.weddingId).order("sort_order"),
  ]);
  if (site.error) throw site.error;
  if (sections.error) throw sections.error;
  return { site: site.data?.wedding_id === membership.weddingId ? site.data : null,
    sections: orderedSections((sections.data ?? []).filter(row => row.wedding_id === membership.weddingId)) };
}
export async function saveWebsite(membership: WorkspaceMembership, draft: SiteDraft, exists: boolean): Promise<void> {
  assertManager(membership);
  const value = siteDraftSchema.parse(draft);
  const fields = { slug: value.slug, template_key: value.template_key, access_mode: value.access_mode,
    title: value.title || null, introduction: value.introduction || null };
  const result = exists
    ? await supabase.from("wedding_websites").update(fields).eq("wedding_id", membership.weddingId).select("wedding_id").maybeSingle()
    : await supabase.from("wedding_websites").insert({ wedding_id: membership.weddingId, ...fields }).select("wedding_id").maybeSingle();
  if (result.error) throw result.error;
  if (result.data?.wedding_id !== membership.weddingId) throw new Error("This Wedding website is unavailable.");
}
export async function chooseTemplate(membership: WorkspaceMembership, template: SiteDraft["template_key"]): Promise<void> {
  assertManager(membership);
  const value = siteDraftSchema.shape.template_key.parse(template);
  const { data, error } = await supabase.from("wedding_websites").update({ template_key: value })
    .eq("wedding_id", membership.weddingId).select("wedding_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This Wedding website is unavailable.");
}
async function requireSection(membership: WorkspaceMembership, id: string): Promise<WebsiteSection> {
  const { data, error } = await supabase.from("wedding_website_sections").select("*")
    .eq("wedding_id", membership.weddingId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This website section is unavailable.");
  return data;
}
export async function ensureStandardSection(membership: WorkspaceMembership, key: string, type: Exclude<SectionType, "CUSTOM">, sortOrder: number): Promise<void> {
  assertManager(membership);
  const { error } = await supabase.from("wedding_website_sections").insert({ wedding_id: membership.weddingId,
    section_key: key, section_type: type, sort_order: sortOrder, audience: "HIDDEN", enabled: false });
  if (error) throw error;
}
export async function saveSection(membership: WorkspaceMembership, id: string, draft: { audience: WebsiteSection["audience"]; enabled: boolean; content: string }): Promise<void> {
  assertManager(membership);
  const section = await requireSection(membership, id);
  const value = sectionDraftSchema.parse(draft);
  const { data, error } = await supabase.from("wedding_website_sections")
    .update({ audience: value.audience, enabled: value.enabled,
      ...(section.section_type === "INTRO" || section.section_type === "CUSTOM" ? { content: value.content || null } : {}) })
    .eq("wedding_id", membership.weddingId).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This website section is unavailable.");
}
export async function moveSection(membership: WorkspaceMembership, sections: WebsiteSection[], id: string, direction: -1 | 1): Promise<void> {
  assertManager(membership);
  const ordered = orderedSections(sections);
  const index = ordered.findIndex(row => row.id === id && row.wedding_id === membership.weddingId);
  const other = ordered[index + direction];
  if (index < 0 || !other) return;
  const current = ordered[index];
  if (!current) return;
  // Temporary nonconflicting order keeps the two writes deterministic; the list is reloaded after the move.
  const next = [...ordered];
  next[index] = other; next[index + direction] = current;
  for (const [position, row] of next.entries()) {
    const { error } = await supabase.from("wedding_website_sections").update({ sort_order: position })
      .eq("wedding_id", membership.weddingId).eq("id", row.id);
    if (error) throw error;
  }
}
export async function createCustomSection(membership: WorkspaceMembership, key: string, content: string, sortOrder: number): Promise<void> {
  assertManager(membership);
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) throw new Error("This section key is invalid.");
  const { error } = await supabase.from("wedding_website_sections").insert({ wedding_id: membership.weddingId,
    section_key: key, section_type: "CUSTOM", sort_order: sortOrder, audience: "HIDDEN", enabled: false, content: content.trim() || null });
  if (error) throw error;
}
export async function deleteCustomSection(membership: WorkspaceMembership, id: string): Promise<void> {
  assertManager(membership);
  const section = await requireSection(membership, id);
  if (section.section_type !== "CUSTOM") throw new Error("This section cannot be deleted.");
  const { data, error } = await supabase.from("wedding_website_sections").delete()
    .eq("wedding_id", membership.weddingId).eq("id", id).eq("section_type", "CUSTOM").select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This website section is unavailable.");
}
export async function setWebsitePublication(membership: WorkspaceMembership, publish: boolean): Promise<void> {
  assertManager(membership);
  const { error } = await supabase.rpc("publish_wedding_website", { p_wedding_id: membership.weddingId, p_publish: publish });
  if (error) throw error;
}
export async function issueHouseholdAccess(membership: WorkspaceMembership, householdId: string): Promise<string> {
  assertManager(membership);
  const { data: household, error: lookupError } = await supabase.from("guest_households").select("id,wedding_id")
    .eq("wedding_id", membership.weddingId).eq("id", householdId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!household) throw new Error("This Household is unavailable in the selected Wedding.");
  const { data, error } = await supabase.rpc("issue_household_website_token", { p_household_id: householdId });
  if (error) throw error;
  if (typeof data !== "string" || !/^[0-9a-f]{64}$/.test(data)) throw new Error("This Household invitation is unavailable.");
  return data;
}
export async function revokeHouseholdAccess(membership: WorkspaceMembership, householdId: string): Promise<void> {
  assertManager(membership);
  const { data: household, error: lookupError } = await supabase.from("guest_households").select("id,wedding_id")
    .eq("wedding_id", membership.weddingId).eq("id", householdId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!household) throw new Error("This Household is unavailable in the selected Wedding.");
  const { error } = await supabase.rpc("revoke_household_website_token", { p_household_id: householdId });
  if (error) throw error;
}
