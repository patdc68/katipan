import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type WorkspaceTabName = "home" | "plan" | "guests" | "budget" | "more";

export function WorkspaceTabIcon({ name, color, size }: { name: WorkspaceTabName; color: ColorValue; size: number }) {
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      {name === "home" && <>
        <Path d="m3.5 10.5 8.5-7 8.5 7" {...stroke} />
        <Path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" {...stroke} />
      </>}
      {name === "plan" && <>
        <Rect x="4" y="4.5" width="16" height="16" rx="2.2" {...stroke} />
        <Path d="M8 3.5v3M16 3.5v3M4.5 9h15M7.5 13h2M7.5 16.5h2M13 13h3.5M13 16.5h3.5" {...stroke} />
      </>}
      {name === "guests" && <>
        <Circle cx="9" cy="8" r="3" {...stroke} />
        <Path d="M3.5 20v-1.4A5.5 5.5 0 0 1 9 13.1a5.5 5.5 0 0 1 5.5 5.5V20z" {...stroke} />
        <Path d="M15 5.2a3 3 0 0 1 0 5.7M16 13.4a5.3 5.3 0 0 1 4.5 5.2V20h-4" {...stroke} />
      </>}
      {name === "budget" && <>
        <Path d="M4 7.5h14.5a2 2 0 0 1 2 2v9h-16a2 2 0 0 1-2-2v-12h14" {...stroke} />
        <Path d="M20.5 11.5h-5a2 2 0 0 0 0 4h5z" {...stroke} />
        <Circle cx="15.5" cy="13.5" r="0.35" fill={color} stroke={color} />
      </>}
      {name === "more" && <>
        <Circle cx="5" cy="12" r="1" fill={color} stroke={color} />
        <Circle cx="12" cy="12" r="1" fill={color} stroke={color} />
        <Circle cx="19" cy="12" r="1" fill={color} stroke={color} />
      </>}
    </Svg>
  );
}
