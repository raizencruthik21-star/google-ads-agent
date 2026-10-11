// The two call-to-action pieces the starter landing page uses.
// Styles are inline design tokens, matching CalmLeadForm.tsx. No new look, no new palette.
import type { CSSProperties } from "react";

/** Scrolls to the form. Smooth scroll and scroll-margin are set in app/globals.css. */
export function CtaButton({ label = "Get my quote", target = "#lead-form", style }: {
  label?: string; target?: string; style?: CSSProperties;
}) {
  return (
    <a href={target} data-cta="form" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
      minHeight: "var(--control-h)", padding: "var(--pad-control)", borderRadius: "var(--radius-control)",
      background: "var(--surface-brand)", color: "var(--text-inverse)", textDecoration: "none",
      font: "var(--type-button)", ...style,
    }}>{label}</a>
  );
}

/** Mobile only: fixed to the bottom of the viewport for the whole scroll. Call left, form right. */
export function MobileCtaBar({ phone, label = "Get my quote" }: { phone: string; label?: string }) {
  return (
    <div className="lp-mobile-cta" style={{
      // display comes from globals.css (.lp-mobile-cta): grid on phones, none on
      // desktop. Inline display here would beat the media query and show the bar everywhere.
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
      gridTemplateColumns: "1fr 1fr", gap: "10px",
      padding: "10px calc(env(safe-area-inset-left) + 12px) calc(env(safe-area-inset-bottom) + 10px)",
      background: "var(--surface-card)", borderTop: "var(--border-hairline) solid var(--line-hairline)",
    }}>
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} data-cta="call" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "var(--control-h)",
        borderRadius: "var(--radius-control)", border: "var(--border-hairline) solid var(--line-hairline)",
        color: "var(--text-strong)", textDecoration: "none", font: "var(--type-button)",
      }}>Call now</a>
      <CtaButton label={label} />
    </div>
  );
}
