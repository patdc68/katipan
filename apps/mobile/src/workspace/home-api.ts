import { supabase } from "../auth/client";
import type { WorkspaceMembership, WorkspaceRole, WorkspaceWedding } from "./model";

export type DashboardTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
};

export type DashboardPlace = {
  id: string;
  name: string;
  address: string | null;
  purposes: string[];
};

export type WeddingDashboard = {
  wedding: Pick<WorkspaceWedding, "id" | "display_name" | "wedding_date" | "general_location" | "status" | "origin" | "ownership_mode"> & { currency_code: string };
  coupleNames: string[];
  planning: { completed: number; total: number };
  upcomingTasks: DashboardTask[];
  guests: { total: number; attending: number; declined: number; pending: number };
  places: DashboardPlace[];
  budget: { currencyCode: string; estimate: number; actual: number; itemCount: number } | null;
};

export function canViewBudgetSummary(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "FULL_COORDINATOR";
}

export async function loadWeddingDashboard(membership: WorkspaceMembership): Promise<WeddingDashboard> {
  if (membership.status !== "ACTIVE") throw new Error("An active Wedding membership is required.");
  const weddingId = membership.weddingId;
  const budgetRequest = canViewBudgetSummary(membership.role)
    ? supabase.from("wedding_budget_totals")
      .select("currency_code,estimated_total,actual_total,active_item_count")
      .eq("wedding_id", weddingId)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    weddingResult,
    partnerResult,
    taskResult,
    taskCountResult,
    completedTaskCountResult,
    guestCountResult,
    attendingCountResult,
    declinedCountResult,
    placeResult,
    purposeResult,
    budgetResult,
  ] = await Promise.all([
    supabase.from("weddings")
      .select("id,display_name,wedding_date,general_location,status,origin,ownership_mode,currency_code")
      .eq("id", weddingId)
      .maybeSingle(),
    supabase.from("wedding_partners")
      .select("partner_order,wedding_people!wedding_partners_person_same_wedding_fkey(display_name)")
      .eq("wedding_id", weddingId)
      .order("partner_order", { ascending: true }),
    supabase.from("planning_tasks")
      .select("id,title,due_date,priority,status")
      .eq("wedding_id", weddingId)
      .neq("status", "COMPLETED")
      .neq("status", "CANCELLED")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(4),
    supabase.from("planning_tasks")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .neq("status", "CANCELLED"),
    supabase.from("planning_tasks")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("status", "COMPLETED"),
    supabase.from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId),
    supabase.from("guest_rsvps")
      .select("guest_id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("status", "ATTENDING"),
    supabase.from("guest_rsvps")
      .select("guest_id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("status", "DECLINED"),
    supabase.from("wedding_places")
      .select("id,source,user_label,custom_name,custom_address")
      .eq("wedding_id", weddingId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("wedding_place_purposes")
      .select("place_id,purpose,purpose_label")
      .eq("wedding_id", weddingId)
      .order("sort_order", { ascending: true }),
    budgetRequest,
  ]);

  const errors = [
    weddingResult.error, partnerResult.error, taskResult.error, taskCountResult.error,
    completedTaskCountResult.error, guestCountResult.error, attendingCountResult.error,
    declinedCountResult.error, placeResult.error, purposeResult.error, budgetResult.error,
  ].filter(Boolean);
  if (errors.length) throw errors[0];
  const wedding = weddingResult.data;
  if (!wedding) throw new Error("Wedding workspace is unavailable.");

  const coupleNames = (partnerResult.data ?? [])
    .map((partner) => partner.wedding_people?.display_name?.trim() ?? "")
    .filter(Boolean);
  const purposes = new Map<string, string[]>();
  for (const item of purposeResult.data ?? []) {
    const labels = purposes.get(item.place_id) ?? [];
    labels.push(item.purpose_label?.trim() || item.purpose.replaceAll("_", " ").toLowerCase());
    purposes.set(item.place_id, labels);
  }
  const places = (placeResult.data ?? []).map((place) => ({
    id: place.id,
    name: place.custom_name?.trim() || place.user_label?.trim() || "Saved place",
    address: place.custom_address?.trim() || wedding.general_location,
    purposes: purposes.get(place.id) ?? [],
  }));

  const totalGuests = guestCountResult.count ?? 0;
  const attending = attendingCountResult.count ?? 0;
  const declined = declinedCountResult.count ?? 0;

  return {
    wedding,
    coupleNames,
    planning: {
      completed: completedTaskCountResult.count ?? 0,
      total: taskCountResult.count ?? 0,
    },
    upcomingTasks: (taskResult.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.due_date,
      priority: task.priority,
      status: task.status,
    })),
    guests: {
      total: totalGuests,
      attending,
      declined,
      pending: Math.max(0, totalGuests - attending - declined),
    },
    places,
    budget: budgetResult.data ? {
      currencyCode: budgetResult.data.currency_code ?? wedding.currency_code,
      estimate: Number(budgetResult.data.estimated_total ?? 0),
      actual: Number(budgetResult.data.actual_total ?? 0),
      itemCount: Number(budgetResult.data.active_item_count ?? 0),
    } : null,
  };
}
