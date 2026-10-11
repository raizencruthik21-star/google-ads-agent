import type { Metadata } from "next";
import { site } from "@/lib/site.config";
import { ConversionTag } from "@/components/lp/ConversionTag";

// NEVER let this page be indexed. If it shows up in search results,
// people land here without converting and your conversion count becomes fiction.
export const metadata: Metadata = {
  title: "Thank you",
  description: "We've got your request.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/thank-you" },
};

export default function ThankYou() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Got it - thanks.</h1>

      {/* THE most important line on this page. A specific time beats "soon" every time, so
          /landing-page swaps this for the owner's real callback time. Never a time they do not keep. */}
      <p className="mt-4 text-lg">
        We have your request and we will call you back.
      </p>

      <p className="mt-6 text-gray-600">Don't want to wait?</p>
      <a
        href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}
        className="mt-2 inline-block rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white"
      >
        Call {site.phone}
      </a>

      {/* CONVERSION TRACKING FIRES HERE, on page load, never on a click. This is why the page
          exists. It fires the form conversion once NEXT_PUBLIC_GADS_ID and NEXT_PUBLIC_GADS_FORM_LABEL
          are set in website/.env.local - /landing-page fills both. Until then nothing is measured. */}
      <ConversionTag />
    </div>
  );
}
