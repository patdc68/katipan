"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { selectGuestPass, type GuestPassProjection } from "../../../../lib/guest-pass-guide";

type GuestPassSwitcherProps = {
  weddingName: string | null;
  weddingDate: string | null;
  websiteTitle: string | null;
  passes: GuestPassProjection[];
};

function formatWeddingDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export default function GuestPassSwitcher({ weddingName, weddingDate, websiteTitle, passes }: GuestPassSwitcherProps) {
  const [selectedGuestId, setSelectedGuestId] = useState(passes[0]?.guestId ?? "");
  const currentPass = selectGuestPass(passes, selectedGuestId);
  const formattedDate = formatWeddingDate(weddingDate);
  if (!currentPass) return null;

  return (
    <main className="guest-pass-page">
      <header className="guest-pass-branding">
        <p className="guest-pass-kicker">KATIPAN · WEDDING DAY</p>
        <p className="guest-pass-wedding-name">{weddingName ?? websiteTitle ?? "Wedding Day"}</p>
        {formattedDate && <p className="guest-pass-date">{formattedDate}</p>}
      </header>

      <section className="guest-pass-content" aria-labelledby="guest-pass-title">
        <div className="guest-pass-heading">
          <p className="guest-pass-eyebrow">YOUR PERSONAL PASS</p>
          <h1 id="guest-pass-title">Wedding-Day Guest Pass</h1>
          {weddingName && websiteTitle && websiteTitle !== weddingName && <p className="guest-pass-site-title">{websiteTitle}</p>}
        </div>

        {passes.length > 1 && (
          <fieldset className="guest-pass-switcher">
            <legend>Choose a Guest Pass</legend>
            <div className="guest-pass-switcher-options">
              {passes.map((pass) => (
                <button
                  key={pass.guestId}
                  type="button"
                  className={pass.guestId === currentPass.guestId ? "guest-pass-choice is-selected" : "guest-pass-choice"}
                  aria-pressed={pass.guestId === currentPass.guestId}
                  onClick={() => setSelectedGuestId(pass.guestId)}
                >
                  {pass.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <article className="guest-pass-card" aria-label={`Guest Pass for ${currentPass.name}`}>
          <div className="guest-pass-holder">
            <p className="guest-pass-eyebrow">ISSUED TO</p>
            <h2>{currentPass.name}</h2>
          </div>

          <div className="guest-pass-qr-frame">
            <QRCodeSVG
              value={currentPass.qrPayload}
              size={264}
              level="H"
              marginSize={4}
              fgColor="#1E1B19"
              bgColor="#FFFFFF"
              role="img"
              aria-label={`Guest Pass QR code for ${currentPass.name}`}
            />
          </div>

          <div className="guest-pass-reference">
            <p className="guest-pass-eyebrow">PASS REFERENCE</p>
            <p className="guest-pass-reference-value">{currentPass.reference}</p>
            <p className="guest-pass-reference-hint">Show this reference if the QR code cannot be scanned.</p>
          </div>

          <p className="guest-pass-guidance">Keep this pass ready to show at the entrance. Your seating details can change; this QR remains your personal pass.</p>
        </article>

        {currentPass.seating.length > 0 && (
          <section className="guest-pass-seating" aria-label="Current seating">
            <p className="guest-pass-seating-label">CURRENT SEATING</p>
            {currentPass.seating.map((seat) => (
              <div className="guest-pass-seating-row" key={`${seat.eventName}:${seat.tableName}:${seat.seatLabel ?? "table"}`}>
                <span>{seat.eventName}</span>
                <strong>{seat.tableName}{seat.seatLabel ? ` / ${seat.seatLabel}` : ""}</strong>
              </div>
            ))}
          </section>
        )}

        <div className="guest-pass-actions">
          <button className="guest-pass-print-button" type="button" onClick={() => window.print()}>Print this pass</button>
        </div>
        {passes.length > 1 && <p className="guest-pass-switch-hint">Each Guest has a separate Pass and QR code.</p>}
      </section>
    </main>
  );
}
