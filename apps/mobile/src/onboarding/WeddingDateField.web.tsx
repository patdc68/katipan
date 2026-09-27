import { createElement } from "react";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { formatWeddingDate } from "./model";

type Props = { date: string; disabled: boolean; onChange: (date: string) => void; label?: string };

export default function WeddingDateField({ date, disabled, onChange, label = "Chosen date" }: Props) {
  return createElement("label", { style: { display: "flex", flexDirection: "column", gap: s.small, minHeight: 56, justifyContent: "center", padding: `${s.small}px ${s.medium}px`, borderRadius: r.medium, background: c.surfaceLow, opacity: disabled ? 0.55 : 1 } },
    createElement("span", { style: { fontSize: 12, color: c.textMuted } }, label),
    createElement("input", {
      type: "date", value: date, disabled, "aria-label": label,
      onChange: (event: { currentTarget: { value: string } }) => onChange(event.currentTarget.value),
      style: { minHeight: 40, border: 0, background: "transparent", color: c.text, font: "inherit" },
      title: date ? formatWeddingDate(date) : "Choose " + label.toLowerCase(),
    }));
}
