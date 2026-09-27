import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { calendarDateToIso, formatWeddingDate, parseCalendarDate } from "./model";
import { KatipanText } from "../ui";

type Props = { date: string; disabled: boolean; onChange: (date: string) => void; label?: string };

export default function WeddingDateField({ date, disabled, onChange, label = "Chosen date" }: Props) {
  const [open, setOpen] = useState(false);
  const [iosDate, setIosDate] = useState(() => parseCalendarDate(date) ?? new Date());
  const selected = parseCalendarDate(date) ?? new Date();
  function handleChange(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "set" && value) {
      onChange(calendarDateToIso(value));
      if (Platform.OS === "ios") setIosDate(value);
    }
  }
  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={date ? label + ", " + formatWeddingDate(date) : "Choose " + label.toLowerCase()}
      accessibilityHint="Opens the date picker"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { setIosDate(selected); setOpen(true); }}
      style={[styles.field, disabled && styles.disabled]}
    >
      <KatipanText variant="label" color="textMuted">{label}</KatipanText>
      <KatipanText>{date ? formatWeddingDate(date) : "Choose a date"}</KatipanText>
    </Pressable>
    {open && Platform.OS === "android" && <DateTimePicker value={selected} mode="date" display="default" onChange={handleChange} accessibilityLabel={label} />}
    {Platform.OS === "ios" && <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" style={styles.scrim} onPress={() => setOpen(false)} />
      <View style={styles.sheet}>
        <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Cancel date selection" onPress={() => setOpen(false)} style={styles.action}><KatipanText color="textMuted">Cancel</KatipanText></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Done selecting wedding date" onPress={() => { onChange(calendarDateToIso(iosDate)); setOpen(false); }} style={styles.action}><KatipanText color="primary">Done</KatipanText></Pressable></View>
        <DateTimePicker value={iosDate} mode="date" display="spinner" onChange={(event, value) => { if (event.type === "set" && value) setIosDate(value); }} accessibilityLabel={label} />
      </View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  field: { minHeight: 56, justifyContent: "center", gap: s.small, paddingHorizontal: s.medium, borderRadius: r.medium, backgroundColor: c.surfaceLow },
  disabled: { opacity: 0.55 },
  scrim: { flex: 1, backgroundColor: "#00000055" },
  sheet: { backgroundColor: c.surfaceLowest, borderTopLeftRadius: r.large, borderTopRightRadius: r.large, padding: s.medium, paddingBottom: s.large },
  actions: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  action: { minHeight: 48, minWidth: 64, justifyContent: "center", paddingHorizontal: s.small },
});
