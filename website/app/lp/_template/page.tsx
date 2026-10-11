// THE STARTER LANDING PAGE TEMPLATE. COPY THIS FOLDER. DO NOT REDESIGN IT.
//
// /landing-page copies this folder to app/lp/<ad-group-slug>/ and changes nothing but the words.
// (A folder that starts with an underscore is never a route, so this file is not a live page.)
//
// Five sections, in this order, then one legal line:
//   1. the headline   2. the proof line   3. the form   4. three reasons   5. a short FAQ
// No header nav and no footer. This is an ad page and every link on it is an exit.
//
// WHAT YOU CHANGE, and nothing else:
//   MAIN_CITY, CTA, SLUG      - the fallback city, the button's words, this page's path
//   every [SQUARE BRACKET]    - copy waiting for this business's words
//   the three reasons, the FAQ
// The business name, phone and address are NOT typed here. They come from lib/site.config.ts,
// so the number is written one way everywhere and Google's call tracking can swap it.
//
// WHAT YOU MAY NEVER DO:
//   - invent a rating, a review count, a years-in-business figure, a guarantee or a result.
//     Every claim must be in context/proof.md first. No proof for a slot? Delete the slot.
//   - add, remove or reorder a section without the owner saying so.
import type { Metadata } from "next";
import "@/app/mainstay.css";
import { SourceCapture } from "@/components/lp/SourceCapture";
import { CalmLeadForm, CalmCallLink } from "@/components/lp/CalmLeadForm";
import { MobileCtaBar } from "@/components/lp/Sections";
import { Icon } from "@/components/kit/Icon";
import { City } from "@/components/lp/City";
import { SectionHeading, TrustBar, FAQItem } from "@/components/kit/Mainstay";
import { site } from "@/lib/site.config";
import { legalName } from "@/lib/site-ready";

export const metadata: Metadata = {
  title: "[Ad group service] in [Main city]",
  description: "[One sentence: what you do and who for, in the words of the ad.]",
  robots: { index: false, follow: false },
};

const BUSINESS = site.name;
const PHONE = site.phone;
// The fallback for <City>. It is MAIN_CITY from .env - the same string the ads use in
// {LOCATION(City):fallback}. Google cannot place the searcher on a large share of clicks, so this
// is the version most visitors read. Never "your area", never a guess.
// MAIN_CITY=none (remote or national): delete the <City> tag and write the H1 without a place.
const MAIN_CITY = "[Main city]";
// One phrase for every button on the page.
const CTA = "[Primary action, e.g. Get my quote]";
// This page's own path, sent with the lead so it can be traced back to the ad group.
const SLUG = "/lp/[ad-group-slug]";

export default function Page() {
  return (
    <>
      <SourceCapture />
      <main className="mainstay" style={{ background: "var(--surface-page)", color: "var(--text-body)" }}>

        {/* Business name and phone as plain content. No nav - this is an ad page. */}
        <div className="gw-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)" }}>
          <span style={{ font: "var(--type-h4)", color: "var(--text-strong)" }}>{BUSINESS}</span>
          <CalmCallLink phone={PHONE} className="ms-btn ms-btn--outline" />
        </div>

        {/* 1 · The headline. The promise of the ad, in the ad's own words, then one button. */}
        <section style={{ padding: "var(--section-y) 0" }}>
          <div className="gw-container" style={{ display: "grid", gap: "var(--space-8)", justifyItems: "center", textAlign: "center", maxWidth: "880px" }}>
            <h1 style={{ font: "var(--type-display-xl)", letterSpacing: "var(--track-display)", color: "var(--text-strong)", margin: 0, maxWidth: "20ch" }}>
              [The service, in the words of the ad] in <City fallback={MAIN_CITY} />
            </h1>
            <p style={{ font: "var(--type-body-lg)", color: "var(--text-muted)", margin: 0, maxWidth: "52ch" }}>
              [One sentence: what you do and what happens next. Plain, nothing you cannot evidence.]
            </p>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
              <a href="#lead-form" className="ms-btn ms-btn--primary" data-l>{CTA} <Icon name="arrow-right" size={17} /></a>
              <span style={{ font: "var(--type-body)", color: "var(--text-body)" }}>or call <CalmCallLink phone={PHONE} label={PHONE} style={{ color: "var(--text-brand)", fontWeight: 700 }} /></span>
            </div>
          </div>
        </section>

        {/* 2 · The proof line. Up to three facts, each one already in context/proof.md.
            A fact that is not on file is deleted, never softened into something plausible. */}
        <section style={{ padding: "var(--space-8) 0", background: "var(--surface-tint)" }}>
          <div className="gw-container" style={{ display: "grid", justifyItems: "center" }}>
            <TrustBar align="center" items={[
              "[Proof one, from proof.md - e.g. the licence or the years trading]",
              "[Proof two, from proof.md - e.g. the review rating with its count]",
              "[Proof three, from proof.md - e.g. the guarantee, word for word]",
            ]} />
          </div>
        </section>

        {/* 3 · The form. Four fields. What happens after they send it sits beside it. */}
        <section id="lead-form" style={{ padding: "var(--section-y) 0" }}>
          <div className="gw-container lp-2up-form" style={{ display: "grid", gap: "var(--space-12)", alignItems: "start" }}>
            <div style={{ display: "grid", gap: "var(--space-6)" }}>
              <SectionHeading eyebrow="[The first step]" title="[What they get, in the words of the ad]"
                lead="[What happens after they send the form, and how soon. One sentence, and true.]" />
              <span style={{ font: "var(--type-body)", color: "var(--text-body)" }}>
                Rather talk it through? Call <CalmCallLink phone={PHONE} label={PHONE} style={{ color: "var(--text-brand)", fontWeight: 700 }} />.
              </span>
            </div>
            <div style={{ padding: "var(--space-9)", background: "var(--surface-card)", border: "var(--border-hairline) solid var(--line-hairline)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-md)" }}>
              <CalmLeadForm business={BUSINESS} phone={PHONE} page={SLUG} cta={CTA} />
            </div>
          </div>
        </section>

        {/* 4 · Three reasons. Why this business over the next quote, in the owner's words. */}
        <section style={{ padding: "var(--section-y) 0", background: "var(--surface-sunken)" }}>
          <div className="gw-container" style={{ display: "grid", gap: "var(--space-9)" }}>
            <SectionHeading eyebrow="Why us" title="[Three reasons people pick this business]" />
            <div className="lp-3up" style={{ display: "grid", gap: "var(--space-7)" }}>
              {[
                { title: "[Reason one]", body: "[One or two plain sentences.]" },
                { title: "[Reason two]", body: "[One or two plain sentences.]" },
                { title: "[Reason three]", body: "[One or two plain sentences.]" },
              ].map((r) => (
                <div key={r.title} style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", padding: "var(--space-7)", background: "var(--surface-card)", borderRadius: "var(--radius-card)", border: "var(--border-hairline) solid var(--line-hairline)" }}>
                  <span style={{ width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--surface-brand)", display: "grid", placeItems: "center" }}>
                    <Icon name="check" size={19} color="var(--text-inverse)" />
                  </span>
                  <strong style={{ font: "var(--type-h4)", color: "var(--text-strong)" }}>{r.title}</strong>
                  <span style={{ font: "var(--type-body)", color: "var(--text-body)" }}>{r.body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 · A short FAQ. The three real reasons people do not enquire, answered straight. */}
        <section style={{ padding: "var(--section-y) 0" }}>
          <div className="gw-container lp-2up-faq" style={{ display: "grid", gap: "var(--space-10)", alignItems: "start" }}>
            <div style={{ display: "grid", gap: "var(--space-6)", alignContent: "start" }}>
              <SectionHeading eyebrow="Questions" title="Before you get in touch" />
              <a href="#lead-form" className="ms-btn ms-btn--primary" data-l style={{ justifySelf: "start" }}>{CTA} <Icon name="arrow-right" size={17} /></a>
            </div>
            <div>
              {[
                { question: "[What does it cost?]", answer: "[The price or range from context/business.md, or exactly how they get one.]" },
                { question: "[How soon can you start?]", answer: "[The honest answer, two sentences at most.]" },
                { question: "[The objection buyers raise most, in their words]", answer: "[The honest answer, two sentences at most.]" },
              ].map((q, i) => <FAQItem key={q.question} {...q} defaultOpen={i === 0} />)}
            </div>
          </div>
        </section>

        {/* The legal line, and nothing after it. */}
        <div className="gw-container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-12)", borderTop: "var(--border-hairline) solid var(--line-hairline)", display: "flex", gap: "var(--space-5)", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ font: "var(--type-caption)", color: "var(--text-faint)" }}>
            {legalName()} · {site.address} · {PHONE}
          </span>
          <span style={{ display: "flex", gap: "var(--space-5)" }}>
            <a href="/privacy-policy" target="_blank" rel="noopener" style={{ font: "var(--type-caption)", color: "var(--text-muted)" }}>Privacy</a>
            <a href="/terms" target="_blank" rel="noopener" style={{ font: "var(--type-caption)", color: "var(--text-muted)" }}>Terms</a>
          </span>
        </div>
        {/* Phones only: call on the left, the form on the right, fixed to the bottom of the screen.
            It sits inside <main> so it wears the same colours as the rest of the page. */}
        <MobileCtaBar phone={PHONE} label={CTA} />
      </main>
    </>
  );
}
