import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type ScrollViewProps, type TextInputProps, type TextProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  borderTokens, colorTokens, elevationTokens, radiusTokens, spacingTokens,
  stateTokens, typographyTokens,
} from "@katipan/ui";

type TextVariant = keyof typeof typographyTokens;
type TextColor = keyof typeof colorTokens;

export type KatipanTextProps = TextProps & {
  variant?: TextVariant;
  color?: TextColor;
};

export function KatipanText({
  variant = "body", color = "text", style, children, ...props
}: KatipanTextProps) {
  const token = typographyTokens[variant];
  return (
    <Text
      allowFontScaling
      {...props}
      style={[{
        color: colorTokens[color],
        fontFamily: token.font,
        fontSize: token.size,
        lineHeight: token.lineHeight,
        letterSpacing: token.size * token.trackingEm,
      }, style]}
    >
      {children}
    </Text>
  );
}

export type KatipanScreenProps = Omit<ScrollViewProps, "children"> & {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

export function KatipanScreen({
  children, scroll = true, padded = true, contentContainerStyle, style, ...props
}: KatipanScreenProps) {
  return (
    <SafeAreaView style={[styles.screen, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          {...props}
          contentContainerStyle={[styles.screenContent, padded && styles.padded, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, padded && styles.padded, contentContainerStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

type ButtonVariant = "primary" | "secondary" | "text";
export type KatipanButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function KatipanButton({
  label, variant = "primary", loading = false, disabled, style, ...props
}: KatipanButtonProps) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      {...props}
      style={(state) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "text" && styles.buttonText,
        state.pressed && variant === "primary" && styles.buttonPressed,
        unavailable && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading && <ActivityIndicator color={variant === "primary" ? colorTokens.onPrimary : colorTokens.primary} />}
      <KatipanText
        variant="labelLarge"
        color={variant === "primary" ? "onPrimary" : "text"}
        style={variant === "text" && styles.textButtonLabel}
      >
        {label}
      </KatipanText>
    </Pressable>
  );
}

export function EditorialCard({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

export type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
};
export function SectionHeader({ title, eyebrow, description, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow && <KatipanText variant="labelCaps" color="secondary">{eyebrow.toUpperCase()}</KatipanText>}
        <KatipanText variant="headlineMedium" accessibilityRole="header">{title}</KatipanText>
        {description && <KatipanText color="textMuted">{description}</KatipanText>}
      </View>
      {action}
    </View>
  );
}

export type StatusChipProps = {
  label: string;
  tone?: keyof Pick<typeof stateTokens, "success" | "warning" | "error" | "neutral">;
};
export function StatusChip({ label, tone = "neutral" }: StatusChipProps) {
  const state = stateTokens[tone];
  return (
    <View style={[styles.chip, { backgroundColor: state.background }]}>
      <KatipanText variant="labelCaps" style={{ color: state.foreground }}>
        {label.toUpperCase()}
      </KatipanText>
    </View>
  );
}

export type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};
export function FormField({
  label, hint, error, onFocus, onBlur, style, ...props
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <KatipanText variant="labelLarge">{label}</KatipanText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colorTokens.outline}
        {...props}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
      />
      {!!error && <KatipanText variant="bodySmall" color="error">{error}</KatipanText>}
      {!error && !!hint && <KatipanText variant="bodySmall" color="textMuted">{hint}</KatipanText>}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colorTokens.primary} />
      <KatipanText color="textMuted">{label}</KatipanText>
    </View>
  );
}

export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.state}>
      <KatipanText variant="headlineMedium" accessibilityRole="header">{title}</KatipanText>
      {!!description && <KatipanText color="textMuted" style={styles.centered}>{description}</KatipanText>}
      {action}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong", description, onRetry,
}: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <View style={styles.state} accessibilityRole="alert">
      <KatipanText variant="headlineMedium" accessibilityRole="header">{title}</KatipanText>
      {!!description && <KatipanText color="textMuted" style={styles.centered}>{description}</KatipanText>}
      {!!onRetry && <KatipanButton label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colorTokens.background },
  screenContent: { flexGrow: 1, gap: spacingTokens.large },
  padded: { paddingHorizontal: spacingTokens.margin, paddingVertical: spacingTokens.large },
  button: {
    minHeight: 48, paddingHorizontal: spacingTokens.large, paddingVertical: spacingTokens.small,
    borderRadius: radiusTokens.pill, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: spacingTokens.small,
  },
  buttonPrimary: {
    backgroundColor: colorTokens.primaryContainer,
    borderWidth: borderTokens.hairline, borderColor: colorTokens.champagne,
  },
  buttonPressed: { backgroundColor: colorTokens.sagePressed },
  buttonSecondary: {
    backgroundColor: colorTokens.softBeige,
    borderWidth: borderTokens.hairline, borderColor: colorTokens.stoneBorder,
  },
  buttonText: { backgroundColor: "transparent" },
  textButtonLabel: { textDecorationLine: "underline", textDecorationColor: colorTokens.antiqueGold },
  disabled: { opacity: 0.5 },
  card: {
    backgroundColor: colorTokens.cardIvory, padding: spacingTokens.card,
    borderRadius: radiusTokens.extraLarge,
    borderWidth: borderTokens.card.width, borderColor: borderTokens.card.color,
    shadowColor: elevationTokens.ambient.color,
    shadowOpacity: elevationTokens.ambient.opacity,
    shadowRadius: elevationTokens.ambient.radius,
    shadowOffset: { width: elevationTokens.ambient.offsetX, height: elevationTokens.ambient.offsetY },
    elevation: elevationTokens.ambient.androidElevation,
  },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: spacingTokens.medium },
  sectionCopy: { flex: 1, gap: spacingTokens.micro },
  chip: {
    alignSelf: "flex-start", borderRadius: radiusTokens.pill,
    paddingHorizontal: spacingTokens.medium, paddingVertical: spacingTokens.small,
  },
  field: { gap: spacingTokens.small },
  input: {
    minHeight: 48, backgroundColor: colorTokens.cardIvory, color: colorTokens.text,
    fontFamily: typographyTokens.body.font, fontSize: typographyTokens.body.size,
    borderRadius: radiusTokens.medium, borderWidth: borderTokens.input.width,
    borderColor: borderTokens.input.color, paddingHorizontal: spacingTokens.medium,
    paddingVertical: 12,
  },
  inputFocused: { borderWidth: borderTokens.focus.width, borderColor: borderTokens.focus.color },
  inputError: { borderColor: colorTokens.error },
  state: {
    minHeight: 160, alignItems: "center", justifyContent: "center",
    gap: spacingTokens.medium, padding: spacingTokens.large,
  },
  centered: { textAlign: "center" },
});
