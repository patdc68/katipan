export function formatWeddingDate(value: string | null, locale?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return null;
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function daysUntilWedding(value: string | null, now = new Date()): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const targetDate = new Date(target);
  if (Number.isNaN(target) || targetDate.toISOString().slice(0, 10) !== value) return null;
  return Math.ceil((target - today.getTime()) / 86_400_000);
}

export function localCalendarDate(now = new Date()): string {
  const year = now.getFullYear().toString().padStart(4, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weddingDisplayName(coupleNames: readonly string[], weddingName: string | null): string {
  const couple = coupleNames.filter(Boolean).join(" & ");
  return couple || weddingName?.trim() || "Your Wedding";
}

export function formatRole(role: string): string {
  return role.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
