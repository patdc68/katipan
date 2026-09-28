import { supabase } from "../auth/client";
import { roleLabel, type WorkspaceMembership } from "../workspace/model";
import { canManageRun, canReviewGuestProgram, orderedRunItems, runDraftSchema,
  type GuestProgramLink, type RunData, type RunDraft, type RunItem, type RunStatus } from "./model";

function assertMember(membership: WorkspaceMembership) {
  if (membership.status !== "ACTIVE" || membership.weddingId !== membership.wedding.id) throw new Error("This Wedding workspace is unavailable.");
}
function assertManager(membership: WorkspaceMembership) {
  assertMember(membership);
  if (!canManageRun(membership)) throw new Error("This membership cannot manage Run of Show.");
}
async function requireItem(weddingId: string, itemId: string): Promise<RunItem> {
  const { data, error } = await supabase.from("wedding_day_items")
    .select("id,wedding_id,title,description,scheduled_start,scheduled_end,actual_start,actual_end,status,sort_order,place_id")
    .eq("wedding_id", weddingId).eq("id", itemId).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw new Error("This Run-of-Show item is unavailable in the selected Wedding.");
  return data;
}
async function requirePlace(weddingId: string, placeId: string | null) {
  if (!placeId) return;
  const { data, error } = await supabase.from("wedding_places").select("id,wedding_id")
    .eq("wedding_id", weddingId).eq("id", placeId).is("archived_at", null).maybeSingle();
  if (error) throw error;
  if (!data || data.wedding_id !== weddingId) throw new Error("This place is unavailable in the selected Wedding.");
}
export async function loadRun(membership: WorkspaceMembership): Promise<RunData> {
  assertMember(membership);
  const weddingId = membership.weddingId;
  const [items, assignments, members, people, places, links] = await Promise.all([
    supabase.from("wedding_day_items").select("id,wedding_id,title,description,scheduled_start,scheduled_end,actual_start,actual_end,status,sort_order,place_id").eq("wedding_id", weddingId),
    supabase.from("wedding_day_item_memberships").select("wedding_id,item_id,membership_id").eq("wedding_id", weddingId),
    supabase.from("wedding_memberships").select("id,wedding_id,user_id,role,status").eq("wedding_id", weddingId).eq("status", "ACTIVE").not("user_id", "is", null),
    supabase.from("wedding_people").select("wedding_id,linked_user_id,display_name").eq("wedding_id", weddingId).not("linked_user_id", "is", null),
    supabase.from("wedding_places").select("id,wedding_id,user_label,custom_name,archived_at").eq("wedding_id", weddingId).is("archived_at", null),
    supabase.from("guest_program_items").select("id,wedding_id,operational_item_id,title,scheduled_start,scheduled_end,is_published,review_required").eq("wedding_id", weddingId).not("operational_item_id", "is", null),
  ]);
  const error = [items.error, assignments.error, members.error, people.error, places.error, links.error].find(Boolean);
  if (error) throw error;
  const names = new Map((people.data ?? []).filter(p => p.wedding_id === weddingId && p.linked_user_id).map(p => [p.linked_user_id, p.display_name]));
  return {
    weddingId,
    items: orderedRunItems((items.data ?? []).filter(row => row.wedding_id === weddingId)),
    assignments: (assignments.data ?? []).filter(row => row.wedding_id === weddingId).map(row => ({ itemId: row.item_id, membershipId: row.membership_id })),
    members: (members.data ?? []).filter(row => row.wedding_id === weddingId && row.user_id).map(row => ({ id: row.id, weddingId, name: names.get(row.user_id!)?.trim() || roleLabel(row.role), role: row.role })),
    places: (places.data ?? []).filter(row => row.wedding_id === weddingId).map(row => ({ id: row.id, weddingId, name: row.user_label?.trim() || row.custom_name?.trim() || "Wedding place" })),
    guestLinks: (links.data ?? []).filter(row => row.wedding_id === weddingId) as GuestProgramLink[],
  };
}
export async function saveRunItem(membership: WorkspaceMembership, draft: RunDraft, itemId?: string): Promise<string> {
  assertManager(membership);
  const value = runDraftSchema.parse(draft);
  await requirePlace(membership.weddingId, value.placeId);
  const fields = { title: value.title, description: value.description || null, scheduled_start: value.scheduledStart,
    scheduled_end: value.scheduledEnd, actual_start: value.actualStart, actual_end: value.actualEnd,
    sort_order: value.sortOrder, place_id: value.placeId };
  if (itemId) {
    await requireItem(membership.weddingId, itemId);
    const { data, error } = await supabase.from("wedding_day_items").update(fields)
      .eq("wedding_id", membership.weddingId).eq("id", itemId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This Run-of-Show item is unavailable in the selected Wedding.");
    return data.id;
  }
  const { data, error } = await supabase.from("wedding_day_items").insert({ wedding_id: membership.weddingId, ...fields })
    .select("id").single();
  if (error) throw error;
  return data.id;
}
export async function deleteRunItem(membership: WorkspaceMembership, itemId: string): Promise<void> {
  assertManager(membership);
  await requireItem(membership.weddingId, itemId);
  const { data, error } = await supabase.from("wedding_day_items").delete()
    .eq("wedding_id", membership.weddingId).eq("id", itemId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This Run-of-Show item is unavailable in the selected Wedding.");
}
export async function changeRunStatus(membership: WorkspaceMembership, itemId: string, status: RunStatus, recordActualTime: boolean): Promise<void> {
  assertManager(membership);
  const item = await requireItem(membership.weddingId, itemId);
  const allowed: RunStatus[] = ["UPCOMING", "IN_PROGRESS", "COMPLETED", "DELAYED", "SKIPPED", "CANCELLED"];
  if (!allowed.includes(status)) throw new Error("This Run-of-Show status is unavailable.");
  const now = new Date().toISOString();
  const timing = status === "IN_PROGRESS" && recordActualTime && !item.actual_start ? { actual_start: now }
    : status === "COMPLETED" && recordActualTime && !item.actual_end ? { actual_end: now, ...(!item.actual_start ? { actual_start: now } : {}) } : {};
  const { data, error } = await supabase.from("wedding_day_items").update({ status, ...timing })
    .eq("wedding_id", membership.weddingId).eq("id", itemId).eq("status", item.status).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This item changed elsewhere. Refresh before changing its status.");
}
export async function setResponsibleMember(membership: WorkspaceMembership, itemId: string, memberId: string, assigned: boolean): Promise<void> {
  assertManager(membership);
  await requireItem(membership.weddingId, itemId);
  const { data: member, error: memberError } = await supabase.from("wedding_memberships")
    .select("id,wedding_id,user_id,status").eq("wedding_id", membership.weddingId).eq("id", memberId)
    .eq("status", "ACTIVE").not("user_id", "is", null).maybeSingle();
  if (memberError) throw memberError;
  if (!member || member.wedding_id !== membership.weddingId || !member.user_id) throw new Error("This team member is unavailable in the selected Wedding.");
  if (assigned) {
    const { error } = await supabase.from("wedding_day_item_memberships")
      .insert({ wedding_id: membership.weddingId, item_id: itemId, membership_id: memberId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from("wedding_day_item_memberships").delete()
      .eq("wedding_id", membership.weddingId).eq("item_id", itemId).eq("membership_id", memberId);
    if (error) throw error;
  }
}
export async function resolveGuestReview(membership: WorkspaceMembership, linkId: string,
  action: "KEEP" | "UPDATE", start?: string, end?: string | null, publish?: boolean): Promise<void> {
  assertMember(membership);
  if (!canReviewGuestProgram(membership)) throw new Error("This membership cannot confirm Guest Program changes.");
  const { data: link, error } = await supabase.from("guest_program_items")
    .select("id,wedding_id,review_required").eq("wedding_id", membership.weddingId).eq("id", linkId).maybeSingle();
  if (error) throw error;
  if (!link || link.wedding_id !== membership.weddingId || !link.review_required) throw new Error("This Guest Program review is unavailable in the selected Wedding.");
  if (action === "UPDATE" && (!start || !Number.isFinite(Date.parse(start)) || (end && Date.parse(end) < Date.parse(start))))
    throw new Error("This Guest Program time is invalid.");
  const { error: rpcError } = await supabase.rpc("set_guest_program_publication", {
    p_item_id: linkId, p_action: action, p_scheduled_start: action === "UPDATE" ? start : undefined,
    p_scheduled_end: action === "UPDATE" ? end ?? undefined : undefined, p_publish: action === "UPDATE" ? publish : undefined,
  });
  if (rpcError) throw rpcError;
}
