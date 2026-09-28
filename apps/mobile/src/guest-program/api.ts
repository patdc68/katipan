import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import { canManageProgram, guestVisibleProgram, orderedProgram, programDraftSchema,
  type OperationalItem, type ProgramData, type ProgramDraft, type ProgramItem } from "./model";

function assertMember(membership: WorkspaceMembership) {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id)
    throw new Error("This Wedding workspace is unavailable.");
}
function assertManager(membership: WorkspaceMembership) {
  assertMember(membership);
  if (!canManageProgram(membership)) throw new Error("This membership cannot manage Guest Program.");
}
async function requireItem(weddingId: string, itemId: string): Promise<ProgramItem> {
  const { data, error } = await supabase.from("guest_program_items")
    .select("id,wedding_id,operational_item_id,title,description,scheduled_start,scheduled_end,place_id,sort_order,is_published,published_at,review_required,review_requested_at,review_confirmed_at,review_resolution")
    .eq("wedding_id", weddingId).eq("id", itemId).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw new Error("This Guest Program item is unavailable in the selected Wedding.");
  return data;
}
async function requirePlace(weddingId: string, placeId: string | null) {
  if (!placeId) return;
  const { data, error } = await supabase.from("wedding_places").select("id,wedding_id")
    .eq("wedding_id", weddingId).eq("id", placeId).is("archived_at", null).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw new Error("This place is unavailable in the selected Wedding.");
}
async function requireOperation(weddingId: string, operationalId: string | null) {
  if (!operationalId) return;
  const { data, error } = await supabase.from("wedding_day_items").select("id,wedding_id")
    .eq("wedding_id", weddingId).eq("id", operationalId).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw new Error("This Run-of-Show item is unavailable in the selected Wedding.");
}
export async function loadProgram(membership: WorkspaceMembership): Promise<ProgramData> {
  assertMember(membership);
  const weddingId = membership.weddingId;
  const [items, operations, places, website] = await Promise.all([
    supabase.from("guest_program_items").select("id,wedding_id,operational_item_id,title,description,scheduled_start,scheduled_end,place_id,sort_order,is_published,published_at,review_required,review_requested_at,review_confirmed_at,review_resolution").eq("wedding_id", weddingId),
    supabase.from("wedding_day_items").select("id,wedding_id,title,scheduled_start,scheduled_end,actual_start,actual_end,status").eq("wedding_id", weddingId),
    supabase.from("wedding_places").select("id,wedding_id,user_label,custom_name").eq("wedding_id", weddingId).is("archived_at", null),
    supabase.from("wedding_websites").select("wedding_id,slug,is_published").eq("wedding_id", weddingId).maybeSingle(),
  ]);
  const error = [items.error, operations.error, places.error, website.error].find(Boolean);
  if (error) throw error;
  return { weddingId,
    items: orderedProgram((items.data ?? []).filter(row => row.wedding_id === weddingId)),
    operations: (operations.data ?? []).filter(row => row.wedding_id === weddingId) as OperationalItem[],
    places: (places.data ?? []).filter(row => row.wedding_id === weddingId).map(row => ({ id: row.id, weddingId, name: row.user_label?.trim() || row.custom_name?.trim() || "Wedding place" })),
    website: website.data?.wedding_id === weddingId ? { slug: website.data.slug, isPublished: website.data.is_published } : null,
  };
}
export async function createProgramItem(membership: WorkspaceMembership, draft: ProgramDraft): Promise<string> {
  assertManager(membership);
  const value = programDraftSchema.parse(draft);
  await Promise.all([requirePlace(membership.weddingId, value.placeId), requireOperation(membership.weddingId, value.operationalItemId)]);
  const { data, error } = await supabase.from("guest_program_items").insert({ wedding_id: membership.weddingId,
    operational_item_id: value.operationalItemId, title: value.title, description: value.description || null,
    scheduled_start: value.scheduledStart, scheduled_end: value.scheduledEnd, place_id: value.placeId,
    sort_order: value.sortOrder }).select("id").single();
  if (error) throw error;
  return data.id;
}
export async function editProgramItem(membership: WorkspaceMembership, itemId: string, draft: ProgramDraft): Promise<void> {
  assertManager(membership);
  const value = programDraftSchema.parse(draft);
  await Promise.all([requireItem(membership.weddingId, itemId), requirePlace(membership.weddingId, value.placeId),
    requireOperation(membership.weddingId, value.operationalItemId)]);
  const { data, error } = await supabase.from("guest_program_items").update({ operational_item_id: value.operationalItemId,
    title: value.title, description: value.description || null, place_id: value.placeId, sort_order: value.sortOrder })
    .eq("wedding_id", membership.weddingId).eq("id", itemId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This Guest Program item is unavailable in the selected Wedding.");
}
export async function deleteProgramItem(membership: WorkspaceMembership, itemId: string): Promise<void> {
  assertManager(membership);
  await requireItem(membership.weddingId, itemId);
  const { data, error } = await supabase.from("guest_program_items").delete()
    .eq("wedding_id", membership.weddingId).eq("id", itemId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This Guest Program item is unavailable in the selected Wedding.");
}
export async function setProgramPublication(membership: WorkspaceMembership, itemId: string,
  action: "KEEP" | "UPDATE", start?: string, end?: string | null, publish?: boolean): Promise<void> {
  assertManager(membership);
  const item = await requireItem(membership.weddingId, itemId);
  if (action === "KEEP" && !item.review_required) throw new Error("This Guest Program review is unavailable in the selected Wedding.");
  if (action === "UPDATE" && (!start || !Number.isFinite(Date.parse(start)) ||
    (end && (!Number.isFinite(Date.parse(end)) || Date.parse(end) < Date.parse(start)))))
    throw new Error("This Guest Program time is invalid.");
  const { error } = await supabase.rpc("set_guest_program_publication", { p_item_id: itemId,
    p_action: action, p_scheduled_start: action === "UPDATE" ? start : undefined,
    p_scheduled_end: action === "UPDATE" ? end ?? undefined : undefined,
    p_publish: action === "UPDATE" ? publish : undefined });
  if (error) throw error;
}
export { guestVisibleProgram };
