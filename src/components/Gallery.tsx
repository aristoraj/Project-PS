"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Photo = { id: string; name: string };

type Props = {
  token: string;
  clientName: string;
  photos: Photo[];
  initialSelected: string[];
  initiallySubmitted: boolean;
};

export default function Gallery({ token, clientName, photos, initialSelected, initiallySubmitted }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [cols, setCols] = useState<2 | 4>(2); // mobile grid density; desktop is automatic
  const [onlySelected, setOnlySelected] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(
    () => (onlySelected ? photos.filter((p) => selected.has(p.id)) : photos),
    [onlySelected, photos, selected],
  );

  const toggle = useCallback(
    async (id: string) => {
      if (submitted) return;
      const on = !selected.has(id);
      setError("");
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
      try {
        const res = await fetch(`/api/g/${token}/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id, selected: on }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Roll back so the screen never shows a choice the server doesn't have.
        setSelected((prev) => {
          const next = new Set(prev);
          if (on) next.delete(id);
          else next.add(id);
          return next;
        });
        setError("Couldn't save that choice. Check your connection and try again.");
      }
    },
    [selected, submitted, token],
  );

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/g/${token}/submit`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubmitted(true);
      setConfirming(false);
      setLightbox(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  // Lightbox keyboard controls
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : Math.min(visible.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === " ") {
        e.preventDefault();
        const p = visible[lightbox];
        if (p) void toggle(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, visible, toggle]);

  const touchX = useRef<number | null>(null);
  const current = lightbox !== null ? visible[lightbox] : undefined;

  return (
    <div className="gallery" style={{ ["--cols" as string]: cols }}>
      <header className="g-head">
        <div>
          <h1>{clientName}</h1>
          <p className="muted">
            {submitted ? "Your selection has been sent. Thank you!" : "Tap the heart on the photos you'd like edited."}
          </p>
        </div>
        <div className="g-tools">
          <div className="seg mobile-only" role="group" aria-label="Grid size">
            <button className={cols === 2 ? "on" : ""} onClick={() => setCols(2)} aria-label="2 columns">▦ 2</button>
            <button className={cols === 4 ? "on" : ""} onClick={() => setCols(4)} aria-label="4 columns">▦ 4</button>
          </div>
          <button className={`chip ${onlySelected ? "on" : ""}`} onClick={() => setOnlySelected((v) => !v)}>
            ♥ Selected ({selected.size})
          </button>
        </div>
      </header>

      {submitted && (
        <div className="g-banner">
          ✓ Submitted — {selected.size} photo{selected.size === 1 ? "" : "s"} will be edited and sent back to you.
        </div>
      )}

      {visible.length === 0 ? (
        <p className="gallery-empty">{onlySelected ? "You haven't selected any photos yet." : "No photos in this gallery yet."}</p>
      ) : (
        <div className="grid">
          {visible.map((p, i) => {
            const on = selected.has(p.id);
            return (
              <div key={p.id} className={`tile ${on ? "on" : ""}`}>
                <button className="tile-img" onClick={() => setLightbox(i)} aria-label={`Open ${p.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/img/${token}/${p.id}?s=500`} alt={p.name} loading="lazy" decoding="async" />
                </button>
                {!submitted && (
                  <button
                    className="heart"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    aria-label={on ? "Remove from selection" : "Select photo"}
                  >
                    {on ? "♥" : "♡"}
                  </button>
                )}
                {submitted && on && <span className="heart static">♥</span>}
              </div>
            );
          })}
        </div>
      )}

      {!submitted && (
        <div className="submit-bar">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          <button className="btn primary" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
            Submit selection
          </button>
        </div>
      )}

      {error && <div className="toast">{error}</div>}

      {current && (
        <div
          className="lightbox"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 50) return;
            setLightbox((i) =>
              i === null ? i : dx < 0 ? Math.min(visible.length - 1, i + 1) : Math.max(0, i - 1),
            );
          }}
        >
          <div className="lb-top">
            <span>{lightbox! + 1} / {visible.length}</span>
            <button className="lb-close" onClick={() => setLightbox(null)} aria-label="Close">✕</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={current.id} src={`/api/img/${token}/${current.id}?s=1600`} alt={current.name} />
          <button className="lb-nav prev" disabled={lightbox === 0} onClick={() => setLightbox(lightbox! - 1)} aria-label="Previous">‹</button>
          <button className="lb-nav next" disabled={lightbox === visible.length - 1} onClick={() => setLightbox(lightbox! + 1)} aria-label="Next">›</button>
          <div className="lb-bottom">
            {!submitted ? (
              <button className={`btn ${selected.has(current.id) ? "primary" : ""}`} onClick={() => toggle(current.id)}>
                {selected.has(current.id) ? "♥ Selected" : "♡ Select this photo"}
              </button>
            ) : (
              selected.has(current.id) && <span className="chip on">♥ Selected</span>
            )}
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-back" onClick={() => !busy && setConfirming(false)}>
          <div className="modal card stack" onClick={(e) => e.stopPropagation()}>
            <h2>Send your selection?</h2>
            <p>
              You&apos;ve chosen <strong>{selected.size}</strong> photo{selected.size === 1 ? "" : "s"}. You won&apos;t be
              able to change this after sending.
            </p>
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => setConfirming(false)}>Keep choosing</button>
              <button className="btn primary" disabled={busy} onClick={submit}>
                {busy ? "Sending…" : "Yes, send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
