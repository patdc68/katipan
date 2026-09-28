import { createElement } from "react";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
type Props = { label: string; value: string | null; onChange: (value: string) => void; disabled?: boolean };
function localInputValue(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
export default function DateTimeField({ label, value, onChange, disabled }: Props) {
  return createElement("label", { style: { display: "flex", flexDirection: "column", gap: s.small, padding: s.medium, borderRadius: r.medium, background: c.surfaceLow } },
    createElement("span", { style: { color: c.text, fontSize: 14 } }, label),
    createElement("input", { type: "datetime-local", value: localInputValue(value), disabled, "aria-label": label,
      onChange: (event: { currentTarget: { value: string } }) => {
        const local = event.currentTarget.value;
        if (local && Number.isFinite(new Date(local).getTime())) onChange(new Date(local).toISOString());
      }, style: { minHeight: 40, border: 0, background: "transparent", color: c.text, font: "inherit" } }));
}
