import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Crypto from "expo-crypto";
import { StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { colorTokens as c, radiusTokens as r, spacingTokens as s } from "@katipan/ui";
import { checkInGuestPass } from "./api";
import { CheckInResultCard, WeddingDayScreenHeader, useWeddingDayRoute } from "./components";
import type { WeddingDayCheckInResult } from "./model";
import { EditorialCard, ErrorState, KatipanButton, KatipanScreen, KatipanText, LoadingState, StatusChip } from "../ui";

export function QrScannerScreen() {
  const { weddingId, router, workspace, membership, isCurrent } = useWeddingDayRoute();
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const [permissionRequestFailed, setPermissionRequestFailed] = useState(false);
  const permissionRequestStarted = useRef(false);
  const processing = useRef(false);
  const scanned = useRef(false);
  const qrToken = useRef<string | null>(null);
  const clientEventId = useRef<string | null>(null);
  const [scanPaused, setScanPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<WeddingDayCheckInResult | null>(null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [scanError, setScanError] = useState(false);
  const scopeKey = `${weddingId}:${membership?.membershipId ?? "none"}:${workspace.selectedWeddingId ?? "none"}:${workspace.cacheRevision}`;
  const scopeRef = useRef(scopeKey);
  const scopeVersion = useRef(0);

  useEffect(() => {
    if (scopeRef.current === scopeKey) return;
    scopeRef.current = scopeKey;
    scopeVersion.current += 1;
    qrToken.current = null;
    clientEventId.current = null;
    scanned.current = false;
    setScanPaused(false);
    setIsProcessing(false);
    setResult(null);
    setOfflineUnavailable(false);
    setScanError(false);
  }, [scopeKey]);

  useEffect(() => {
    if (!isCurrent || permission?.granted || permissionRequestStarted.current) return;
    permissionRequestStarted.current = true;
    setRequesting(true);
    void requestPermission()
      .catch(() => setPermissionRequestFailed(true))
      .finally(() => setRequesting(false));
  }, [isCurrent, permission, requestPermission]);

  const sendToken = useCallback(async () => {
    if (!membership || !qrToken.current || !clientEventId.current || processing.current) return;
    const actionVersion = scopeVersion.current;
    processing.current = true;
    setIsProcessing(true);
    setScanError(false);
    try {
      const outcome = await checkInGuestPass(membership, qrToken.current, clientEventId.current);
      if (scopeVersion.current !== actionVersion) return;
      if (outcome.kind === "OFFLINE_UNAVAILABLE") {
        qrToken.current = null;
        clientEventId.current = null;
        setOfflineUnavailable(true);
        setScanPaused(true);
        scanned.current = true;
      } else {
        qrToken.current = null;
        setResult(outcome.result);
        setScanPaused(true);
        scanned.current = true;
      }
    } catch {
      if (scopeVersion.current !== actionVersion) return;
      // Keep the token only in memory so retrying this same scan can reuse its idempotency key.
      setScanError(true);
      setScanPaused(true);
      scanned.current = true;
    } finally {
      processing.current = false;
      setIsProcessing(false);
    }
  }, [membership]);

  const handleBarcode = useCallback((scan: BarcodeScanningResult) => {
    if (processing.current || scanned.current) return;
    scanned.current = true;
    qrToken.current = scan.data;
    clientEventId.current = Crypto.randomUUID();
    setScanPaused(true);
    setResult(null);
    setOfflineUnavailable(false);
    setScanError(false);
    void sendToken();
  }, [sendToken]);

  const startAnotherScan = () => {
    qrToken.current = null;
    clientEventId.current = null;
    processing.current = false;
    scanned.current = false;
    setScanPaused(false);
    setResult(null);
    setOfflineUnavailable(false);
    setScanError(false);
  };

  if (workspace.loading) return <KatipanScreen><LoadingState label="Opening scanner…" /></KatipanScreen>;
  if (!isCurrent || !membership) {
    return <KatipanScreen><ErrorState title="Wedding workspace unavailable" description="Choose a Wedding you currently belong to." onRetry={() => router.replace("/(workspace)/weddings")} /></KatipanScreen>;
  }

  const goToManual = () => router.replace({ pathname: "/(wedding)/[weddingId]/day/check-in", params: { weddingId } } as unknown as Href);

  return (
    <KatipanScreen contentContainerStyle={styles.page}>
      <WeddingDayScreenHeader title="Scan Guest Pass" onBack={() => router.back()} />
      <KatipanText color="textMuted">The QR payload is sent unchanged to the Wedding-Day check-in RPC for secure validation.</KatipanText>

      {permission?.granted ? (
        <View style={styles.cameraFrame}>
          {!scanPaused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleBarcode}
              accessibilityLabel="Guest Pass QR scanner"
            />
          ) : (
            <View style={styles.cameraPaused}>
              <KatipanText variant="title" color="onPrimary">{isProcessing ? "Checking Guest Pass…" : "Scanner paused"}</KatipanText>
              <KatipanText color="onPrimary">A scan is handled once before another scan can begin.</KatipanText>
            </View>
          )}
        </View>
      ) : requesting || permission === null ? (
        <EditorialCard style={styles.permissionCard}><LoadingState label="Requesting camera access…" /></EditorialCard>
      ) : (
        <EditorialCard style={styles.permissionCard}>
          <StatusChip label="Camera unavailable" tone="warning" />
          <KatipanText variant="headlineSmall" accessibilityRole="header">Use Manual Check-In</KatipanText>
          <KatipanText color="textMuted">
            {permissionRequestFailed || permission?.canAskAgain === false
              ? "Camera access was not granted. You can check in Guests by name instead."
              : "Camera access is needed only to scan a Guest Pass. Manual Guest search is available now."}
          </KatipanText>
          {permission?.canAskAgain && <KatipanButton label="Allow Camera" variant="secondary" onPress={() => void requestPermission()} />}
          <KatipanButton label="Manual Check-In" onPress={goToManual} />
        </EditorialCard>
      )}

      {offlineUnavailable && (
        <EditorialCard style={styles.resultCard} accessibilityRole="alert">
          <StatusChip label="QR not verified" tone="warning" />
          <KatipanText variant="title">A connection is required to verify a Guest Pass.</KatipanText>
          <KatipanText color="textMuted">The QR was not queued or checked in. Use Manual Check-In to find a cached Guest; any manual action will remain pending until the server confirms it.</KatipanText>
          <KatipanButton label="Manual Check-In" onPress={goToManual} />
        </EditorialCard>
      )}
      {scanError && (
        <EditorialCard style={styles.resultCard} accessibilityRole="alert">
          <StatusChip label="Check-In not confirmed" tone="warning" />
          <KatipanText color="textMuted">We could not confirm this scan. Retry the same action when connected, or use Manual Check-In.</KatipanText>
          <KatipanButton label="Retry This Scan" loading={isProcessing} onPress={() => void sendToken()} />
          <KatipanButton label="Manual Check-In" variant="secondary" onPress={goToManual} />
        </EditorialCard>
      )}
      <CheckInResultCard result={result} />
      {result && <KatipanButton label="Scan Another Pass" variant="secondary" onPress={startAnotherScan} />}
      {!result && !offlineUnavailable && !scanError && permission?.granted && scanPaused && !isProcessing
        && <KatipanButton label="Scan Guest Pass" variant="secondary" onPress={startAnotherScan} />}
    </KatipanScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: s.large, paddingBottom: s.extraLarge },
  cameraFrame: { height: 360, overflow: "hidden", borderRadius: r.extraLarge, borderWidth: 1, borderColor: c.champagne, backgroundColor: c.primary },
  camera: { flex: 1 },
  cameraPaused: { flex: 1, alignItems: "center", justifyContent: "center", gap: s.medium, padding: s.cardLarge },
  permissionCard: { gap: s.medium, backgroundColor: c.surfaceLowest },
  resultCard: { gap: s.medium, backgroundColor: c.surfaceLow },
});
