import { File } from "expo-file-system";
import { supabase } from "../auth/client";
import type { WorkspaceMembership } from "../workspace/model";
import {
  attireGroupDraftSchema,
  canManageWeddingStyling,
  canReadWeddingStyling,
  dressCodeDraftSchema,
  guestGuidanceDraftSchema,
  motifDraftSchema,
  normalizeColorName,
  normalizeHexColor,
  orderedColors,
  stylingColorDraftSchema,
  type AttireGroup,
  type AttireGroupDraft,
  type ColorCollectionRef,
  type DressCodeDraft,
  type GuestGuidanceDraft,
  type MotifDraft,
  type StylingColor,
  type StylingImage,
  type WeddingStylingData,
} from "./model";

type InspirationSource = "MOTIF" | "DRESS_CODE" | "ATTIRE_GROUP";
export type InspirationUploadFile = { name: string; contentType: string; bytes: ArrayBuffer };

function assertMember(membership: WorkspaceMembership): void {
  if (!canReadWeddingStyling(membership)) throw new Error("This Wedding workspace is unavailable.");
}

function assertManager(membership: WorkspaceMembership): void {
  assertMember(membership);
  if (!canManageWeddingStyling(membership)) throw Object.assign(new Error("Styling changes are not permitted for this membership."), { code: "42501" });
}

function requireResult<T>(data: T | null, error: unknown, message: string): T {
  if (error) throw error;
  if (data === null) throw new Error(message);
  return data;
}

type MotifImageLink = { wedding_id: string; motif_id: string; attachment_id: string; sort_order: number };
type DressImageLink = { wedding_id: string; dress_code_id: string; attachment_id: string; sort_order: number };
type GroupImageLink = { wedding_id: string; attire_group_id: string; attachment_id: string; sort_order: number };

async function makeImages(
  weddingId: string,
  links: readonly (MotifImageLink | DressImageLink | GroupImageLink)[],
): Promise<StylingImage[]> {
  const safeLinks = links.filter((link) => link.wedding_id === weddingId);
  const attachmentIds = [...new Set(safeLinks.map((link) => link.attachment_id))];
  if (attachmentIds.length === 0) return [];
  const { data, error } = await supabase.from("attachments").select("*")
    .eq("wedding_id", weddingId).in("id", attachmentIds);
  if (error) throw error;
  const eligible = (data ?? []).filter((attachment) => attachment.wedding_id === weddingId
    && attachment.bucket_id === "wedding-files"
    && attachment.status === "AVAILABLE"
    && (attachment.visibility === "GUEST_VISIBLE" || attachment.visibility === "WEDDING_MEMBER_PRIVATE"));
  const signed = await Promise.all(eligible.map(async (attachment) => {
    const { data: urlData, error: urlError } = await supabase.storage
      .from("wedding-files").createSignedUrl(attachment.object_path, 60);
    return [attachment.id, urlError ? null : urlData?.signedUrl ?? null] as const;
  }));
  const signedById = new Map(signed);
  const attachmentById = new Map(eligible.map((attachment) => [attachment.id, attachment]));
  return safeLinks.flatMap((link) => {
    const attachment = attachmentById.get(link.attachment_id);
    if (!attachment) return [];
    return [{ attachment, signedUrl: signedById.get(attachment.id) ?? null, sort_order: link.sort_order }];
  }).sort((a, b) => a.sort_order - b.sort_order || a.attachment.id.localeCompare(b.attachment.id));
}

export async function loadWeddingStyling(membership: WorkspaceMembership): Promise<WeddingStylingData> {
  assertMember(membership);
  const weddingId = membership.weddingId;
  const [motifResult, motifColorsResult, motifImagesResult, dressResult,
    recommendedResult, avoidResult, dressImagesResult, groupsResult,
    groupRecommendedResult, groupAvoidResult, guestTargetsResult, roleTargetsResult,
    groupImagesResult, guidanceResult, guestRecommendedResult, guestAvoidResult,
    guestsResult, peopleResult, rolesResult, assignmentsResult] = await Promise.all([
    supabase.from("wedding_motifs").select("*").eq("wedding_id", weddingId).maybeSingle(),
    supabase.from("motif_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("motif_inspiration_attachments").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("wedding_dress_codes").select("*").eq("wedding_id", weddingId).maybeSingle(),
    supabase.from("dress_code_recommended_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("dress_code_avoid_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("dress_code_inspiration_attachments").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("attire_groups").select("*").eq("wedding_id", weddingId).order("sort_order").order("title"),
    supabase.from("attire_group_recommended_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("attire_group_avoid_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("attire_group_guest_targets").select("*").eq("wedding_id", weddingId),
    supabase.from("attire_group_entourage_role_targets").select("*").eq("wedding_id", weddingId),
    supabase.from("attire_group_inspiration_attachments").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("guest_attire_guidance").select("*").eq("wedding_id", weddingId),
    supabase.from("guest_attire_recommended_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("guest_attire_avoid_colors").select("*").eq("wedding_id", weddingId).order("sort_order"),
    supabase.from("guests").select("id,wedding_id,person_id").eq("wedding_id", weddingId).order("created_at"),
    supabase.from("wedding_people").select("id,wedding_id,display_name").eq("wedding_id", weddingId),
    supabase.from("entourage_roles").select("id,wedding_id,name").eq("wedding_id", weddingId).order("sort_order").order("name"),
    supabase.from("entourage_assignments").select("id,wedding_id,guest_id,role_id").eq("wedding_id", weddingId),
  ]);

  const error = [motifResult.error, motifColorsResult.error, motifImagesResult.error, dressResult.error,
    recommendedResult.error, avoidResult.error, dressImagesResult.error, groupsResult.error,
    groupRecommendedResult.error, groupAvoidResult.error, guestTargetsResult.error, roleTargetsResult.error,
    groupImagesResult.error, guidanceResult.error, guestRecommendedResult.error, guestAvoidResult.error,
    guestsResult.error, peopleResult.error, rolesResult.error, assignmentsResult.error].find(Boolean);
  if (error) throw error;

  const motif = motifResult.data?.wedding_id === weddingId ? motifResult.data : null;
  const dressCode = dressResult.data?.wedding_id === weddingId ? dressResult.data : null;
  const motifImages = await makeImages(weddingId, motifImagesResult.data ?? []);
  const dressImages = await makeImages(weddingId, dressImagesResult.data ?? []);
  const groupImages = await makeImages(weddingId, groupImagesResult.data ?? []);
  const peopleById = new Map((peopleResult.data ?? []).filter((person) => person.wedding_id === weddingId)
    .map((person) => [person.id, person.display_name]));
  const guests = (guestsResult.data ?? []).flatMap((guest) => {
    const displayName = peopleById.get(guest.person_id);
    if (guest.wedding_id !== weddingId || !displayName) return [];
    return [{ id: guest.id, wedding_id: weddingId, display_name: displayName }];
  });
  const groups = (groupsResult.data ?? []).filter((group) => group.wedding_id === weddingId);
  const groupData = groups.map((group) => ({
    group,
    recommendedColors: (groupRecommendedResult.data ?? []).filter((color) => color.wedding_id === weddingId && color.attire_group_id === group.id),
    avoidColors: (groupAvoidResult.data ?? []).filter((color) => color.wedding_id === weddingId && color.attire_group_id === group.id),
    guestTargets: (guestTargetsResult.data ?? []).filter((target) => target.wedding_id === weddingId && target.attire_group_id === group.id),
    roleTargets: (roleTargetsResult.data ?? []).filter((target) => target.wedding_id === weddingId && target.attire_group_id === group.id),
    inspiration: groupImages.filter((item) => groupImagesResult.data?.some((link) => link.wedding_id === weddingId
      && link.attire_group_id === group.id && link.attachment_id === item.attachment.id)),
  }));

  return {
    weddingId,
    motif,
    motifColors: (motifColorsResult.data ?? []).filter((color) => color.wedding_id === weddingId),
    motifInspiration: motifImages,
    dressCode,
    dressRecommendedColors: (recommendedResult.data ?? []).filter((color) => color.wedding_id === weddingId),
    dressAvoidColors: (avoidResult.data ?? []).filter((color) => color.wedding_id === weddingId),
    dressInspiration: dressImages,
    attireGroups: groupData,
    guestGuidance: (guidanceResult.data ?? []).filter((guidance) => guidance.wedding_id === weddingId),
    guestRecommendedColors: (guestRecommendedResult.data ?? []).filter((color) => color.wedding_id === weddingId),
    guestAvoidColors: (guestAvoidResult.data ?? []).filter((color) => color.wedding_id === weddingId),
    guests,
    entourageRoles: (rolesResult.data ?? []).filter((role) => role.wedding_id === weddingId),
    entourageAssignments: (assignmentsResult.data ?? []).filter((assignment) => assignment.wedding_id === weddingId),
  };
}

export async function saveWeddingMotif(membership: WorkspaceMembership, draft: MotifDraft): Promise<void> {
  assertManager(membership);
  const value = motifDraftSchema.parse(draft);
  const { data, error } = await supabase.from("wedding_motifs").upsert({
    wedding_id: membership.weddingId,
    title: value.title,
    description: value.description || null,
    notes: value.notes || null,
  }, { onConflict: "wedding_id" }).select("id,wedding_id").maybeSingle();
  requireResult(data?.wedding_id === membership.weddingId ? data : null, error, "This Wedding motif is unavailable.");
}

export async function deleteWeddingMotif(membership: WorkspaceMembership, motifId: string): Promise<void> {
  assertManager(membership);
  const { data, error } = await supabase.from("wedding_motifs").delete()
    .eq("wedding_id", membership.weddingId).eq("id", motifId).select("id").maybeSingle();
  requireResult(data, error, "This Wedding motif is unavailable.");
}

export async function saveWeddingDressCode(membership: WorkspaceMembership, draft: DressCodeDraft): Promise<void> {
  assertManager(membership);
  const value = dressCodeDraftSchema.parse(draft);
  const { data, error } = await supabase.from("wedding_dress_codes").upsert({
    wedding_id: membership.weddingId,
    title: value.title,
    description: value.description || null,
    venue_advice: value.venueAdvice || null,
    general_notes: value.generalNotes || null,
  }, { onConflict: "wedding_id" }).select("id,wedding_id").maybeSingle();
  requireResult(data?.wedding_id === membership.weddingId ? data : null, error, "This Wedding dress code is unavailable.");
}

export async function deleteWeddingDressCode(membership: WorkspaceMembership, dressCodeId: string): Promise<void> {
  assertManager(membership);
  const { data, error } = await supabase.from("wedding_dress_codes").delete()
    .eq("wedding_id", membership.weddingId).eq("id", dressCodeId).select("id").maybeSingle();
  requireResult(data, error, "This Wedding dress code is unavailable.");
}

async function nextColorSortOrder(membership: WorkspaceMembership, collection: ColorCollectionRef): Promise<number> {
  let highest = -1;
  switch (collection.kind) {
    case "motif": {
      const { data, error } = await supabase.from("motif_colors").select("sort_order").eq("wedding_id", membership.weddingId).eq("motif_id", collection.parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      highest = data?.sort_order ?? -1;
      break;
    }
    case "dress-recommended":
    case "dress-avoid": {
      const table = collection.kind === "dress-recommended" ? "dress_code_recommended_colors" : "dress_code_avoid_colors";
      const { data, error } = await supabase.from(table).select("sort_order").eq("wedding_id", membership.weddingId).eq("dress_code_id", collection.parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      highest = data?.sort_order ?? -1;
      break;
    }
    case "group-recommended":
    case "group-avoid": {
      const table = collection.kind === "group-recommended" ? "attire_group_recommended_colors" : "attire_group_avoid_colors";
      const { data, error } = await supabase.from(table).select("sort_order").eq("wedding_id", membership.weddingId).eq("attire_group_id", collection.parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      highest = data?.sort_order ?? -1;
      break;
    }
    case "guest-recommended":
    case "guest-avoid": {
      const table = collection.kind === "guest-recommended" ? "guest_attire_recommended_colors" : "guest_attire_avoid_colors";
      const { data, error } = await supabase.from(table).select("sort_order").eq("wedding_id", membership.weddingId).eq("guest_attire_guidance_id", collection.parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      highest = data?.sort_order ?? -1;
      break;
    }
  }
  return highest + 1;
}

export async function saveStylingColor(
  membership: WorkspaceMembership,
  collection: ColorCollectionRef,
  draft: { colorHex: string; name: string },
  existingId?: string,
): Promise<void> {
  assertManager(membership);
  const value = stylingColorDraftSchema.parse(draft);
  const colorHex = normalizeHexColor(value.colorHex);
  const name = normalizeColorName(value.name);
  const sortOrder = existingId === undefined ? await nextColorSortOrder(membership, collection) : undefined;
  let result: { error: unknown; data: { id: string; wedding_id: string } | null };
  switch (collection.kind) {
    case "motif": {
      const q = supabase.from("motif_colors");
      const mutation = existingId
        ? q.update({ color_hex: colorHex, name }).eq("id", existingId).eq("motif_id", collection.parentId).eq("wedding_id", membership.weddingId)
        : q.insert({ wedding_id: membership.weddingId, motif_id: collection.parentId, color_hex: colorHex, name, sort_order: sortOrder ?? 0 });
      result = await mutation.select("id,wedding_id").maybeSingle();
      break;
    }
    case "dress-recommended":
    case "dress-avoid": {
      const table = collection.kind === "dress-recommended" ? "dress_code_recommended_colors" : "dress_code_avoid_colors";
      const q = supabase.from(table);
      const mutation = existingId
        ? q.update({ color_hex: colorHex, name }).eq("id", existingId).eq("dress_code_id", collection.parentId).eq("wedding_id", membership.weddingId)
        : q.insert({ wedding_id: membership.weddingId, dress_code_id: collection.parentId, color_hex: colorHex, name, sort_order: sortOrder ?? 0 });
      result = await mutation.select("id,wedding_id").maybeSingle();
      break;
    }
    case "group-recommended":
    case "group-avoid": {
      const table = collection.kind === "group-recommended" ? "attire_group_recommended_colors" : "attire_group_avoid_colors";
      const q = supabase.from(table);
      const mutation = existingId
        ? q.update({ color_hex: colorHex, name }).eq("id", existingId).eq("attire_group_id", collection.parentId).eq("wedding_id", membership.weddingId)
        : q.insert({ wedding_id: membership.weddingId, attire_group_id: collection.parentId, color_hex: colorHex, name, sort_order: sortOrder ?? 0 });
      result = await mutation.select("id,wedding_id").maybeSingle();
      break;
    }
    case "guest-recommended":
    case "guest-avoid": {
      const table = collection.kind === "guest-recommended" ? "guest_attire_recommended_colors" : "guest_attire_avoid_colors";
      const q = supabase.from(table);
      const mutation = existingId
        ? q.update({ color_hex: colorHex, name }).eq("id", existingId).eq("guest_attire_guidance_id", collection.parentId).eq("wedding_id", membership.weddingId)
        : q.insert({ wedding_id: membership.weddingId, guest_attire_guidance_id: collection.parentId, color_hex: colorHex, name, sort_order: sortOrder ?? 0 });
      result = await mutation.select("id,wedding_id").maybeSingle();
      break;
    }
  }
  requireResult(result.data?.wedding_id === membership.weddingId ? result.data : null, result.error, "This styling color is unavailable.");
}

export async function deleteStylingColor(
  membership: WorkspaceMembership,
  collection: ColorCollectionRef,
  colorId: string,
): Promise<void> {
  assertManager(membership);
  let result: { error: unknown; data: { id: string } | null };
  switch (collection.kind) {
    case "motif":
      result = await supabase.from("motif_colors").delete().eq("wedding_id", membership.weddingId).eq("motif_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      break;
    case "dress-recommended":
    case "dress-avoid": {
      const table = collection.kind === "dress-recommended" ? "dress_code_recommended_colors" : "dress_code_avoid_colors";
      result = await supabase.from(table).delete().eq("wedding_id", membership.weddingId).eq("dress_code_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      break;
    }
    case "group-recommended":
    case "group-avoid": {
      const table = collection.kind === "group-recommended" ? "attire_group_recommended_colors" : "attire_group_avoid_colors";
      result = await supabase.from(table).delete().eq("wedding_id", membership.weddingId).eq("attire_group_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      break;
    }
    case "guest-recommended":
    case "guest-avoid": {
      const table = collection.kind === "guest-recommended" ? "guest_attire_recommended_colors" : "guest_attire_avoid_colors";
      result = await supabase.from(table).delete().eq("wedding_id", membership.weddingId).eq("guest_attire_guidance_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      break;
    }
  }
  requireResult(result.data, result.error, "This styling color is unavailable.");
}

async function updateColorOrder(
  membership: WorkspaceMembership,
  collection: ColorCollectionRef,
  colorId: string,
  sortOrder: number,
): Promise<void> {
  switch (collection.kind) {
    case "motif": {
      const { data, error } = await supabase.from("motif_colors").update({ sort_order: sortOrder }).eq("wedding_id", membership.weddingId).eq("motif_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      requireResult(data, error, "This motif color is unavailable.");
      break;
    }
    case "dress-recommended":
    case "dress-avoid": {
      const table = collection.kind === "dress-recommended" ? "dress_code_recommended_colors" : "dress_code_avoid_colors";
      const { data, error } = await supabase.from(table).update({ sort_order: sortOrder }).eq("wedding_id", membership.weddingId).eq("dress_code_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      requireResult(data, error, "This dress code color is unavailable.");
      break;
    }
    case "group-recommended":
    case "group-avoid": {
      const table = collection.kind === "group-recommended" ? "attire_group_recommended_colors" : "attire_group_avoid_colors";
      const { data, error } = await supabase.from(table).update({ sort_order: sortOrder }).eq("wedding_id", membership.weddingId).eq("attire_group_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      requireResult(data, error, "This attire group color is unavailable.");
      break;
    }
    case "guest-recommended":
    case "guest-avoid": {
      const table = collection.kind === "guest-recommended" ? "guest_attire_recommended_colors" : "guest_attire_avoid_colors";
      const { data, error } = await supabase.from(table).update({ sort_order: sortOrder }).eq("wedding_id", membership.weddingId).eq("guest_attire_guidance_id", collection.parentId).eq("id", colorId).select("id").maybeSingle();
      requireResult(data, error, "This guest color is unavailable.");
      break;
    }
  }
}

export async function reorderStylingColors(
  membership: WorkspaceMembership,
  collection: ColorCollectionRef,
  colors: readonly StylingColor[],
  orderedIds: readonly string[],
): Promise<void> {
  assertManager(membership);
  const ordered = orderedColors(colors);
  if (ordered.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length
    || ordered.some((color) => !orderedIds.includes(color.id))) {
    throw new Error("This color order is out of date. Refresh and try again.");
  }
  const temporaryStart = Math.max(0, ...ordered.map((color) => color.sort_order)) + ordered.length + 10;
  for (const [index, colorId] of orderedIds.entries()) await updateColorOrder(membership, collection, colorId, temporaryStart + index);
  for (const [index, colorId] of orderedIds.entries()) await updateColorOrder(membership, collection, colorId, index);
}

export async function saveAttireGroup(
  membership: WorkspaceMembership,
  dressCodeId: string,
  draft: AttireGroupDraft,
  existingId?: string,
): Promise<void> {
  assertManager(membership);
  const value = attireGroupDraftSchema.parse(draft);
  const { data: dressCode, error: dressError } = await supabase.from("wedding_dress_codes").select("id,wedding_id")
    .eq("wedding_id", membership.weddingId).eq("id", dressCodeId).maybeSingle();
  requireResult(dressCode?.wedding_id === membership.weddingId ? dressCode : null, dressError, "This Wedding dress code is unavailable.");
  if (existingId) {
    const { data, error } = await supabase.from("attire_groups").update({ title: value.title, description: value.description || null, instructions: value.instructions || null })
      .eq("wedding_id", membership.weddingId).eq("dress_code_id", dressCodeId).eq("id", existingId).select("id,wedding_id").maybeSingle();
    requireResult(data?.wedding_id === membership.weddingId ? data : null, error, "This attire group is unavailable.");
  } else {
    const { data: lastGroup, error: orderError } = await supabase.from("attire_groups").select("sort_order")
      .eq("wedding_id", membership.weddingId).eq("dress_code_id", dressCodeId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (orderError) throw orderError;
    const { data, error } = await supabase.from("attire_groups").insert({ wedding_id: membership.weddingId, dress_code_id: dressCodeId,
      title: value.title, description: value.description || null, instructions: value.instructions || null, sort_order: (lastGroup?.sort_order ?? -1) + 1 })
      .select("id,wedding_id").maybeSingle();
    requireResult(data?.wedding_id === membership.weddingId ? data : null, error, "This attire group is unavailable.");
  }
}

export async function deleteAttireGroup(membership: WorkspaceMembership, dressCodeId: string, groupId: string): Promise<void> {
  assertManager(membership);
  const { data, error } = await supabase.from("attire_groups").delete().eq("wedding_id", membership.weddingId)
    .eq("dress_code_id", dressCodeId).eq("id", groupId).select("id").maybeSingle();
  requireResult(data, error, "This attire group is unavailable.");
}

export async function reorderAttireGroups(membership: WorkspaceMembership, groups: readonly AttireGroup[], orderedIds: readonly string[]): Promise<void> {
  assertManager(membership);
  const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  if (ordered.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length || ordered.some((group) => !orderedIds.includes(group.id))) {
    throw new Error("This group order is out of date. Refresh and try again.");
  }
  const current = new Map(ordered.map((group) => [group.id, group]));
  const temporaryStart = Math.max(0, ...ordered.map((group) => group.sort_order)) + ordered.length + 10;
  for (const [index, id] of orderedIds.entries()) {
    const group = current.get(id);
    if (!group || group.wedding_id !== membership.weddingId) throw new Error("This attire group is unavailable.");
    const { data, error } = await supabase.from("attire_groups").update({ sort_order: temporaryStart + index })
      .eq("wedding_id", membership.weddingId).eq("dress_code_id", group.dress_code_id).eq("id", id).select("id").maybeSingle();
    requireResult(data, error, "This attire group is unavailable.");
  }
  for (const [index, id] of orderedIds.entries()) {
    const group = current.get(id);
    if (!group) continue;
    const { data, error } = await supabase.from("attire_groups").update({ sort_order: index })
      .eq("wedding_id", membership.weddingId).eq("dress_code_id", group.dress_code_id).eq("id", id).select("id").maybeSingle();
    requireResult(data, error, "This attire group is unavailable.");
  }
}

async function assertGroupAndGuest(membership: WorkspaceMembership, dressCodeId: string, groupId: string, guestId: string): Promise<void> {
  const [groupResult, guestResult] = await Promise.all([
    supabase.from("attire_groups").select("id,wedding_id,dress_code_id").eq("wedding_id", membership.weddingId).eq("dress_code_id", dressCodeId).eq("id", groupId).maybeSingle(),
    supabase.from("guests").select("id,wedding_id").eq("wedding_id", membership.weddingId).eq("id", guestId).maybeSingle(),
  ]);
  requireResult(groupResult.data?.wedding_id === membership.weddingId ? groupResult.data : null, groupResult.error, "This attire group is unavailable.");
  if (groupResult.data?.id !== groupId || groupResult.data.dress_code_id !== dressCodeId) throw new Error("This attire group is unavailable.");
  requireResult(guestResult.data?.wedding_id === membership.weddingId ? guestResult.data : null, guestResult.error, "This Guest is unavailable in the selected Wedding.");
  if (guestResult.data?.id !== guestId) throw new Error("This Guest is unavailable in the selected Wedding.");
}

export async function setAttireGroupGuestTarget(membership: WorkspaceMembership, dressCodeId: string, groupId: string, guestId: string, assigned: boolean): Promise<void> {
  assertManager(membership);
  await assertGroupAndGuest(membership, dressCodeId, groupId, guestId);
  if (assigned) {
    const { error } = await supabase.from("attire_group_guest_targets").upsert({ wedding_id: membership.weddingId, attire_group_id: groupId, guest_id: guestId },
      { onConflict: "wedding_id,attire_group_id,guest_id", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.from("attire_group_guest_targets").delete().eq("wedding_id", membership.weddingId)
    .eq("attire_group_id", groupId).eq("guest_id", guestId).select("guest_id").maybeSingle();
  requireResult(data, error, "This Guest target is unavailable.");
}

export async function setAttireGroupRoleTarget(membership: WorkspaceMembership, dressCodeId: string, groupId: string, roleId: string, assigned: boolean): Promise<void> {
  assertManager(membership);
  const [groupResult, roleResult] = await Promise.all([
    supabase.from("attire_groups").select("id,wedding_id,dress_code_id").eq("wedding_id", membership.weddingId).eq("dress_code_id", dressCodeId).eq("id", groupId).maybeSingle(),
    supabase.from("entourage_roles").select("id,wedding_id").eq("wedding_id", membership.weddingId).eq("id", roleId).maybeSingle(),
  ]);
  requireResult(groupResult.data?.wedding_id === membership.weddingId ? groupResult.data : null, groupResult.error, "This attire group is unavailable.");
  if (groupResult.data?.id !== groupId || groupResult.data.dress_code_id !== dressCodeId) throw new Error("This attire group is unavailable.");
  requireResult(roleResult.data?.wedding_id === membership.weddingId ? roleResult.data : null, roleResult.error, "This Entourage role is unavailable in the selected Wedding.");
  if (roleResult.data?.id !== roleId) throw new Error("This Entourage role is unavailable in the selected Wedding.");
  if (assigned) {
    const { error } = await supabase.from("attire_group_entourage_role_targets").upsert({ wedding_id: membership.weddingId, attire_group_id: groupId, entourage_role_id: roleId },
      { onConflict: "wedding_id,attire_group_id,entourage_role_id", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.from("attire_group_entourage_role_targets").delete().eq("wedding_id", membership.weddingId)
    .eq("attire_group_id", groupId).eq("entourage_role_id", roleId).select("entourage_role_id").maybeSingle();
  requireResult(data, error, "This Entourage role target is unavailable.");
}

export async function saveGuestAttireGuidance(membership: WorkspaceMembership, guestId: string, draft: GuestGuidanceDraft): Promise<string> {
  assertManager(membership);
  const value = guestGuidanceDraftSchema.parse(draft);
  const { data: guest, error: guestError } = await supabase.from("guests").select("id,wedding_id")
    .eq("wedding_id", membership.weddingId).eq("id", guestId).maybeSingle();
  requireResult(guest?.wedding_id === membership.weddingId ? guest : null, guestError, "This Guest is unavailable in the selected Wedding.");
  if (guest?.id !== guestId) throw new Error("This Guest is unavailable in the selected Wedding.");
  const { data, error } = await supabase.from("guest_attire_guidance").upsert({ wedding_id: membership.weddingId, guest_id: guestId,
    title: value.title || null, instructions: value.instructions, notes: value.notes || null }, { onConflict: "wedding_id,guest_id" })
    .select("id,wedding_id,guest_id").maybeSingle();
  const row = requireResult(data?.wedding_id === membership.weddingId && data.guest_id === guestId ? data : null,
    error, "Guest attire guidance is unavailable.");
  return row.id;
}

export async function deleteGuestAttireGuidance(membership: WorkspaceMembership, guestId: string, guidanceId: string): Promise<void> {
  assertManager(membership);
  const { data, error } = await supabase.from("guest_attire_guidance").delete().eq("wedding_id", membership.weddingId)
    .eq("guest_id", guestId).eq("id", guidanceId).select("id").maybeSingle();
  requireResult(data, error, "Guest attire guidance is unavailable.");
}

async function nextInspirationSortOrder(membership: WorkspaceMembership, source: InspirationSource, parentId: string): Promise<number> {
  if (source === "MOTIF") {
    const { data, error } = await supabase.from("motif_inspiration_attachments").select("sort_order").eq("wedding_id", membership.weddingId).eq("motif_id", parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return (data?.sort_order ?? -1) + 1;
  }
  if (source === "DRESS_CODE") {
    const { data, error } = await supabase.from("dress_code_inspiration_attachments").select("sort_order").eq("wedding_id", membership.weddingId).eq("dress_code_id", parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return (data?.sort_order ?? -1) + 1;
  }
  const { data, error } = await supabase.from("attire_group_inspiration_attachments").select("sort_order").eq("wedding_id", membership.weddingId).eq("attire_group_id", parentId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data?.sort_order ?? -1) + 1;
}

async function createInspirationLink(membership: WorkspaceMembership, source: InspirationSource, parentId: string, attachmentId: string, sortOrder: number): Promise<void> {
  const wedding_id = membership.weddingId;
  if (source === "MOTIF") {
    const { error } = await supabase.from("motif_inspiration_attachments").insert({ wedding_id, motif_id: parentId, attachment_id: attachmentId, sort_order: sortOrder });
    if (error) throw error;
  } else if (source === "DRESS_CODE") {
    const { error } = await supabase.from("dress_code_inspiration_attachments").insert({ wedding_id, dress_code_id: parentId, attachment_id: attachmentId, sort_order: sortOrder });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attire_group_inspiration_attachments").insert({ wedding_id, attire_group_id: parentId, attachment_id: attachmentId, sort_order: sortOrder });
    if (error) throw error;
  }
}

async function markAndRemoveReservedObject(attachmentId: string, objectPath: string, uploaded: boolean): Promise<void> {
  const { error: markError } = await supabase.rpc("mark_attachment_deleted", { p_attachment_id: attachmentId });
  if (markError) return;
  if (uploaded) await supabase.storage.from("wedding-files").remove([objectPath]);
}

export async function uploadStylingInspiration(
  membership: WorkspaceMembership,
  source: InspirationSource,
  parentId: string,
  file: InspirationUploadFile,
  visibility: "GUEST_VISIBLE" | "WEDDING_MEMBER_PRIVATE",
): Promise<void> {
  assertManager(membership);
  if (!file.name.trim() || file.bytes.byteLength <= 0 || !/^image\/(jpeg|png|webp|gif)$/i.test(file.contentType)) {
    throw Object.assign(new Error("Choose a non-empty JPEG, PNG, WebP, or GIF image."), { code: "22023" });
  }
  const sortOrder = await nextInspirationSortOrder(membership, source, parentId);
  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_attachment", {
    p_wedding_id: membership.weddingId,
    p_original_filename: file.name.trim(),
    p_content_type: file.contentType,
    p_visibility: visibility,
  });
  if (reservationError) throw reservationError;
  const reserved = reservation?.[0];
  if (!reserved?.attachment_id || reserved.bucket_id !== "wedding-files" || !reserved.object_path) {
    throw new Error("The image upload could not be prepared.");
  }

  let uploaded = false;
  try {
    const { error: uploadError } = await supabase.storage.from("wedding-files").upload(reserved.object_path, file.bytes, {
      contentType: file.contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: confirmationError } = await supabase.rpc("confirm_attachment_uploaded", {
      p_attachment_id: reserved.attachment_id,
      p_size_bytes: file.bytes.byteLength,
    });
    if (confirmationError) throw confirmationError;

    await createInspirationLink(membership, source, parentId, reserved.attachment_id, sortOrder);
  } catch (cause) {
    await markAndRemoveReservedObject(reserved.attachment_id, reserved.object_path, uploaded);
    throw cause;
  }
}

export async function unlinkStylingInspiration(
  membership: WorkspaceMembership,
  source: InspirationSource,
  parentId: string,
  attachmentId: string,
): Promise<void> {
  assertManager(membership);
  if (source === "MOTIF") {
    const { data, error } = await supabase.from("motif_inspiration_attachments").delete().eq("wedding_id", membership.weddingId).eq("motif_id", parentId).eq("attachment_id", attachmentId).select("attachment_id").maybeSingle();
    requireResult(data, error, "This motif inspiration is unavailable.");
  } else if (source === "DRESS_CODE") {
    const { data, error } = await supabase.from("dress_code_inspiration_attachments").delete().eq("wedding_id", membership.weddingId).eq("dress_code_id", parentId).eq("attachment_id", attachmentId).select("attachment_id").maybeSingle();
    requireResult(data, error, "This dress code inspiration is unavailable.");
  } else {
    const { data, error } = await supabase.from("attire_group_inspiration_attachments").delete().eq("wedding_id", membership.weddingId).eq("attire_group_id", parentId).eq("attachment_id", attachmentId).select("attachment_id").maybeSingle();
    requireResult(data, error, "This attire group inspiration is unavailable.");
  }
  // Unlinking removes this styling use only. The Wedding Attachment is retained for any other links or later reuse.
}

export async function readPickedImage(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
