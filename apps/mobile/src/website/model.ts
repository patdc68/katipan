import { z } from "zod";
import type { Database } from "@katipan/database/types";
import type { WorkspaceMembership } from "../workspace/model";

export type Website = Database["public"]["Tables"]["wedding_websites"]["Row"];
export type WebsiteSection = Database["public"]["Tables"]["wedding_website_sections"]["Row"];
export type TemplateKey = Database["public"]["Enums"]["website_template"];
export type Audience = Database["public"]["Enums"]["website_section_audience"];
export type SectionType = Database["public"]["Enums"]["website_section_type"];
export type WebsiteData = { site: Website | null; sections: WebsiteSection[] };

export const templates: { key: TemplateKey; name: string; description: string }[] = [
  { key: "SAMPAGUITA", name: "Sampaguita", description: "Soft ivory and floral elegance" },
  { key: "LUNTIAN", name: "Luntian", description: "Garden greens and grounded warmth" },
  { key: "FILIPINIANA", name: "Filipiniana", description: "Heritage detail and warm gold" },
  { key: "MODERN_LOVE", name: "Modern Love", description: "Clean lines and editorial type" },
  { key: "AFTER_DARK", name: "After Dark", description: "Evening contrast and champagne accents" },
];
export const audiences: Audience[] = ["PUBLIC", "INVITED", "PERSONALIZED", "HIDDEN"];
export const standardSections: { key: string; type: SectionType; label: string }[] = [
  { key: "intro", type: "INTRO", label: "Welcome" },
  { key: "places", type: "PLACES", label: "Places" },
  { key: "dress_code", type: "DRESS_CODE", label: "Dress Code" },
  { key: "rsvp", type: "RSVP", label: "RSVP" },
];

export const slugSchema = z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use 3–80 lowercase letters, numbers, and single hyphens.");
export const siteDraftSchema = z.object({
  slug: slugSchema,
  template_key: z.enum(["SAMPAGUITA", "LUNTIAN", "FILIPINIANA", "MODERN_LOVE", "AFTER_DARK"]),
  access_mode: z.enum(["ANYONE_WITH_LINK", "INVITED_GUESTS_ONLY"]),
  title: z.string().trim().max(160),
  introduction: z.string().trim().max(4000),
});
export type SiteDraft = z.input<typeof siteDraftSchema>;
export const sectionDraftSchema = z.object({
  audience: z.enum(["PUBLIC", "INVITED", "PERSONALIZED", "HIDDEN"]),
  enabled: z.boolean(),
  content: z.string().trim().max(4000),
});

export function canManageWebsite(membership: WorkspaceMembership | null | undefined): boolean {
  return Boolean(membership && membership.status === "ACTIVE" && membership.weddingId === membership.wedding.id
    && ["DRAFT", "ACTIVE"].includes(membership.wedding.status)
    && ["OWNER", "FULL_COORDINATOR"].includes(membership.role));
}
export function orderedSections(sections: readonly WebsiteSection[]): WebsiteSection[] {
  return [...sections].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}
export function safeWebsiteError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the website details.";
  if (error && typeof error === "object" && "code" in error && error.code === "23505")
    return "This address is already in use. Choose another Wedding website address.";
  if (error instanceof Error && error.message.startsWith("This ")) return error.message;
  return "We couldn't save this website change. Refresh and try again.";
}
export class SubmitGate {
  private busy = false;
  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.busy) return undefined;
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }
}
