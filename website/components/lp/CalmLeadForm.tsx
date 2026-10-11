"use client";
// The landing page form, wired up.
//
// Four fields and nothing else: first name, last name, email, phone. Anything more is asked on
// the call. Styles are the template's own (the uppercase tracked label, the sunken fill, the
// brand full-width button). The plumbing is what makes it an ads form: the stashed gclid and
// keyword riding along as hidden fields, the honeypot, the consent line, the post to /api/lead
// and the redirect to /thank-you, where the conversion tag fires.
import { useEffect, useState } from "react";
import { readSource, type LeadSource } from "@/lib/source";

const HIDDEN_KEYS: (keyof LeadSource)[] = [
  "gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "keyword", "campaign", "adgroup", "matchtype", "device", "network", "creative", "landing_page", "referrer", "landed_at",
];

const LABEL: React.CSSProperties = {
  font: "var(--type-label)", letterSpacing: "var(--track-label)",
  textTransform: "uppercase", color: "var(--text-muted)",
};
const FIELD: React.CSSProperties = {
  width: "100%", minHeight: "var(--control-h)", padding: "var(--pad-control)",
  font: "var(--type-body)", color: "var(--text-strong)", background: "var(--surface-sunken)",
  borderColor: "var(--line-hairline)", borderRadius: "var(--radius-input)",
  transition: "var(--transition-control)", outline: "none", boxShadow: "none",
};
const BUTTON: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
  font: "var(--type-button)", letterSpacing: "0.005em", borderRadius: "var(--radius-control)",
  borderColor: "transparent", cursor: "pointer", textDecoration: "none",
  transition: "var(--transition-control), transform var(--dur-instant) var(--ease-standard)",
  whiteSpace: "nowrap", minHeight: "var(--control-h)", padding: "var(--pad-control)",
  background: "var(--surface-brand)", color: "var(--text-inverse)", width: "100%",
};
const CAPTION: React.CSSProperties = { font: "var(--type-caption)", color: "var(--text-muted)" };

function Field({ label, name, type = "text", placeholder, inputMode, autoComplete }: {
  label: string; name: string; type?: string; placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={LABEL}>{label}<span style={{ color: "var(--status-critical)" }}> *</span></span>
      <input
        name={name} type={type} required placeholder={placeholder}
        inputMode={inputMode} autoComplete={autoComplete} style={FIELD}
      />
    </label>
  );
}

// cta: the button's words, so the page uses one phrase everywhere.
export function CalmLeadForm({ business, phone, page, cta = "Get my quote" }: {
  business: string; phone: string; page: string; cta?: string;
}) {
  const [source, setSource] = useState<LeadSource>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSource(readSource()); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // With JS we post in the background and show a friendly error if the
    // webhook is down. Without JS the plain POST below still works.
    e.preventDefault();
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const res = await fetch("/api/lead", { method: "POST", body: new FormData(e.currentTarget), redirect: "manual" });
      // Success is the route's 303 to /thank-you. A failure comes back as a JSON error status.
      if (res.ok || res.type === "opaqueredirect" || res.status === 0) {
        window.location.assign("/thank-you");
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" action="/api/lead" onSubmit={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <Field label="First name" name="first_name" placeholder="First" autoComplete="given-name" />
        <Field label="Last name" name="last_name" placeholder="Last" autoComplete="family-name" />
      </div>
      <Field label="Email" name="email" type="email" placeholder="you@example.com" inputMode="email" autoComplete="email" />
      <Field label="Phone" name="phone" type="tel" placeholder="So we can call you back" inputMode="tel" autoComplete="tel" />

      {/* Honeypot. Humans never see it; bots fill it and get quietly dropped. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="company_fax">Fax</label>
        <input id="company_fax" name="company_fax" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", ...CAPTION }}>
        <input type="checkbox" name="sms_consent" value="yes" style={{ marginTop: 2, width: 16, height: 16, flex: "none" }} />
        <span>{business} may text me about my request. Msg and data rates may apply. Reply STOP to cancel, HELP for help.</span>
      </label>

      {HIDDEN_KEYS.map((k) => <input key={k} type="hidden" name={k} value={source[k] ?? ""} />)}
      <input type="hidden" name="page" value={page} />

      <button type="submit" disabled={busy} style={{ ...BUTTON, opacity: busy ? 0.5 : 1 }}>
        {busy ? "Sending" : cta}
      </button>

      {failed && (
        <span role="alert" style={{ ...CAPTION, color: "var(--status-critical)" }}>
          That did not send. Call {phone} and we will take it over the phone.
        </span>
      )}
      <span style={{ ...CAPTION, textAlign: "center" }}>
        Your details go to us and nobody else. <a href="/privacy-policy">Privacy policy</a>.
      </span>
    </form>
  );
}

// The click-to-call link, in the template's pill. Before the phone dials it
// fires the stashed keyword and gclid to the webhook, so one real number still
// tells you which keyword rang the phone. No number pools, no per-page numbers.
export function CalmCallLink({ phone, label, style, className }: {
  phone: string; label?: string; style?: React.CSSProperties; className?: string;
}) {
  const tel = "tel:" + phone.replace(/[^+\d]/g, "");
  const fire = () => {
    try {
      const payload = { ...readSource(), event: "call_click", phone, page: window.location.pathname };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!navigator.sendBeacon("/api/lead", blob)) {
        fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch {
      // Never block the call because tracking hiccuped.
    }
  };
  // data-wcm-number marks the places where the number itself is printed, so
  // Google's snippet rewrites the label and the href together. A custom label
  // ("Call us") is left alone; only its href is swapped.
  return (
    <a href={tel} className={className} onClick={fire} aria-label={`Call ${phone}`} style={style} {...(!label || label.includes(phone) ? { "data-wcm-number": "" } : {})}>
      {label ?? `Call ${phone}`}
    </a>
  );
}
