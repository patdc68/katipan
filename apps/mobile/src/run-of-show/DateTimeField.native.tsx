import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { KatipanText } from "../ui";

type Props = { label: string; value: string | null; onChange: (value: string) => void; disabled?: boolean };
export default function DateTimeField({ label, value, onChange, disabled }: Props) {
  const [step, setStep] = useState<"date" | "time" | null>(null);
  const [chosen, setChosen] = useState(new Date());
  const selected = value && Number.isFinite(Date.parse(value)) ? new Date(value) : new Date();
  function pick(event: DateTimePickerEvent, next?: Date) {
    if (Platform.OS === "android") {
      if (event.type !== "set" || !next) { setStep(null); return; }
      if (step === "date") {
        const combined = new Date(selected);
        combined.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
        setChosen(combined); setStep("time");
      } else { onChange(next.toISOString()); setStep(null); }
    } else if (event.type === "set" && next) setChosen(next);
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { setChosen(selected); setStep("date"); }} style={styles.field}>
      <KatipanText variant="labelLarge">{label}</KatipanText>
      <KatipanText color="textMuted">{value ? selected.toLocaleString() : "Choose date and time"}</KatipanText>
    </Pressable>
    {Platform.OS === "android" && step && <DateTimePicker
      value={step === "date" ? selected : chosen} mode={step} display="default"
      onChange={(event, next) => {
        if (step === "time" && event.type === "set" && next) {
          const combined = new Date(chosen); combined.setHours(next.getHours(), next.getMinutes(), 0, 0);
          onChange(combined.toISOString()); setStep(null);
        } else pick(event, next);
      }} accessibilityLabel={label} />}
    {Platform.OS === "ios" && <Modal visible={step !== null} transparent animationType="slide" onRequestClose={() => setStep(null)}>
      <Pressable style={styles.scrim} onPress={() => setStep(null)} accessibilityLabel="Close date and time picker" />
      <View style={styles.sheet}>
        <View style={styles.actions}>
          <Pressable onPress={() => setStep(null)}><KatipanText>Cancel</KatipanText></Pressable>
          <Pressable onPress={() => { onChange(chosen.toISOString()); setStep(null); }}><KatipanText color="primary">Done</KatipanText></Pressable>
        </View>
        <DateTimePicker value={chosen} mode="datetime" display="spinner" onChange={pick} accessibilityLabel={label} />
      </View>
    </Modal>}
  </>;
}
const styles = StyleSheet.create({
  field: { minHeight: 64, justifyContent: "center", gap: s.micro, padding: s.medium, borderRadius: r.medium, backgroundColor: c.surfaceLow },
  scrim: { flex: 1, backgroundColor: "#00000055" },
  sheet: { backgroundColor: c.surfaceLowest, borderTopLeftRadius: r.large, borderTopRightRadius: r.large, padding: s.medium },
  actions: { flexDirection: "row", justifyContent: "space-between", padding: s.medium },
});
