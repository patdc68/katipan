"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  countResponded,
  formatGuestRsvpStatus,
  guestRouteHref,
  GUEST_RSVP_CHOICES,
  tryBeginGuestRsvpSubmit,
  type GuestRsvpChoice,
  type GuestRsvpGuest,
} from "../../../../lib/guest-rsvp";

type Draft = {
  status: GuestRsvpChoice | null;
  mealChoice: string;
  dietaryNotes: string;
  responseNotes: string;
};

type Feedback = { kind: "saved" | "error"; message: string };

function draftFor(guest: GuestRsvpGuest): Draft {
  return {
    status: guest.status === "NO_RESPONSE" ? null : guest.status,
    mealChoice: guest.mealChoice ?? "",
    dietaryNotes: guest.dietaryNotes ?? "",
    responseNotes: guest.responseNotes ?? "",
  };
}

function draftsFor(guests: readonly GuestRsvpGuest[]): Record<string, Draft> {
  return Object.fromEntries(guests.map((guest) => [guest.guestId, draftFor(guest)]));
}

export default function GuestRsvpForm({
  slug,
  token,
  guests,
}: {
  slug: string;
  token: string;
  guests: GuestRsvpGuest[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => draftsFor(guests));
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [feedback, setFeedback] = useState<Record<string, Feedback | undefined>>({});
  const dirtyGuests = useRef(new Set<string>());
  const inFlightGuests = useRef(new Set<string>());
  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const guest of guests) {
        if (!dirtyGuests.current.has(guest.guestId)) next[guest.guestId] = draftFor(guest);
      }
      return next;
    });
  }, [guests]);

  function updateDraft(guestId: string, change: Partial<Draft>) {
    dirtyGuests.current.add(guestId);
    setDrafts((current) => ({ ...current, [guestId]: { ...current[guestId], ...change } }));
    setFeedback((current) => ({ ...current, [guestId]: undefined }));
  }

  async function saveGuestResponse(guest: GuestRsvpGuest, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = drafts[guest.guestId];
    if (!draft?.status || !tryBeginGuestRsvpSubmit(inFlightGuests.current, guest.guestId)) return;
    setPendingIds((current) => new Set(current).add(guest.guestId));
    setFeedback((current) => ({ ...current, [guest.guestId]: undefined }));
    try {
      const response = await fetch(`/api/w/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          slug,
          token,
          guestId: guest.guestId,
          status: draft.status,
          mealChoice: draft.mealChoice.trim() ? draft.mealChoice : null,
          dietaryNotes: draft.dietaryNotes.trim() ? draft.dietaryNotes : null,
          responseNotes: draft.responseNotes.trim() ? draft.responseNotes : null,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setFeedback((current) => ({
          ...current,
          [guest.guestId]: {
            kind: "error",
            message: result?.error ?? "Your response could not be saved. Please try again.",
          },
        }));
        return;
      }

      dirtyGuests.current.delete(guest.guestId);
      setFeedback((current) => ({
        ...current,
        [guest.guestId]: { kind: "saved", message: "Your response was saved." },
      }));
      router.refresh();
    } catch {
      setFeedback((current) => ({
        ...current,
        [guest.guestId]: { kind: "error", message: "Your response could not be saved. Check your connection and try again." },
      }));
    } finally {
      inFlightGuests.current.delete(guest.guestId);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(guest.guestId);
        return next;
      });
    }
  }

  const responded = countResponded(guests);

  return (
    <section className="guest-rsvp-form" aria-label="Individual Guest responses">
      <div className="guide-card guest-rsvp-progress" role="status" aria-live="polite">
        <p className="guide-eyebrow">HOUSEHOLD PROGRESS</p>
        <p><strong>{responded} of {guests.length} responded</strong></p>
        <p className="guide-muted">Each response is saved for that Guest only.</p>
      </div>

      <div className="guest-rsvp-guest-list">
        {guests.map((guest) => {
          const draft = drafts[guest.guestId] ?? draftFor(guest);
          const isSaving = pendingIds.has(guest.guestId);
          const message = feedback[guest.guestId];
          const prefix = `guest-${guest.guestId}`;
          const messageId = `${prefix}-message`;
          const statusId = `${prefix}-status`;
          const mealId = `${prefix}-meal`;
          const dietaryId = `${prefix}-dietary`;
          const notesId = `${prefix}-notes`;

          return (
            <form
              key={guest.guestId}
              className="guide-card guest-rsvp-card"
              aria-labelledby={`${prefix}-name`}
              aria-busy={isSaving}
              onSubmit={(event) => void saveGuestResponse(guest, event)}
            >
              <div className="guest-rsvp-card-heading">
                <div>
                  <p className="guide-eyebrow">INDIVIDUAL GUEST</p>
                  <h2 id={`${prefix}-name`}>{guest.name}</h2>
                </div>
                <p className="guest-rsvp-current-status" id={statusId}>
                  Current response: <strong>{formatGuestRsvpStatus(guest.status)}</strong>
                </p>
              </div>

              <fieldset className="guest-rsvp-choices" aria-describedby={message ? messageId : undefined}>
                <legend>Choose a response for {guest.name}</legend>
                <div className="guest-rsvp-choice-list">
                  {GUEST_RSVP_CHOICES.map((choice) => {
                    const choiceId = `${prefix}-${choice.toLowerCase()}`;
                    return (
                      <label
                        className={draft.status === choice ? "guest-rsvp-choice is-selected" : "guest-rsvp-choice"}
                        htmlFor={choiceId}
                        key={choice}
                      >
                        <input
                          type="radio"
                          id={choiceId}
                          name={`${prefix}-response`}
                          value={choice}
                          checked={draft.status === choice}
                          required
                          disabled={isSaving}
                          onChange={() => updateDraft(guest.guestId, { status: choice })}
                          aria-describedby={message ? messageId : statusId}
                        />
                        <span>{choice === "ATTENDING" ? "Attend" : "Decline"}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {draft.status === "ATTENDING" && (
                <div className="guest-rsvp-fields">
                  <div className="guest-rsvp-field">
                    <label htmlFor={mealId}>Meal choice <span>(optional)</span></label>
                    <input
                      id={mealId}
                      name="mealChoice"
                      type="text"
                      maxLength={2000}
                      autoComplete="off"
                      value={draft.mealChoice}
                      disabled={isSaving}
                      onChange={(event) => updateDraft(guest.guestId, { mealChoice: event.target.value })}
                    />
                  </div>
                  <div className="guest-rsvp-field">
                    <label htmlFor={dietaryId}>Dietary notes <span>(optional)</span></label>
                    <textarea
                      id={dietaryId}
                      name="dietaryNotes"
                      rows={3}
                      maxLength={2000}
                      value={draft.dietaryNotes}
                      disabled={isSaving}
                      onChange={(event) => updateDraft(guest.guestId, { dietaryNotes: event.target.value })}
                    />
                  </div>
                  <div className="guest-rsvp-field">
                    <label htmlFor={notesId}>A note for the couple <span>(optional)</span></label>
                    <textarea
                      id={notesId}
                      name="responseNotes"
                      rows={3}
                      maxLength={2000}
                      value={draft.responseNotes}
                      disabled={isSaving}
                      onChange={(event) => updateDraft(guest.guestId, { responseNotes: event.target.value })}
                    />
                  </div>
                </div>
              )}

              {draft.status === "DECLINED" && (
                <p className="guest-rsvp-decline-note">You can update this response while your Household invitation link is active.</p>
              )}

              {message && (
                <p id={messageId} className={`guest-rsvp-feedback is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"} aria-live={message.kind === "error" ? "assertive" : "polite"}>
                  {message.message}
                </p>
              )}

              <button className="guide-action guest-rsvp-submit" type="submit" disabled={isSaving || draft.status === null}>
                {isSaving ? "Saving response…" : `Save response for ${guest.name}`}
              </button>
            </form>
          );
        })}
      </div>

      <div className="guest-rsvp-review">
        <p className="guide-muted">You can edit an individual Guest response again while invitation access is valid.</p>
        <Link className="guest-secondary-action" href={guestRouteHref(slug, "/rsvp/confirmation", token)}>Review Household responses</Link>
      </div>
    </section>
  );
}
