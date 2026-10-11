import { NextResponse } from "next/server";
import { site } from "@/lib/site.config";

// Every form on the site posts here, and every click-to-call fires here first.
// This forwards both to ONE inbound webhook (GoHighLevel, or any CRM that takes
// a JSON POST) with the visitor's gclid, keyword and UTMs attached, then sends
// form leads to /thank-you, where the conversion tag fires.
//
// The webhook is LEAD_WEBHOOK_URL in website/.env.local (and in the Vercel
// project's environment variables once the site is live). leadWebhook in
// lib/site.config.ts is the fallback. Until one of them is set, a submission
// returns a clear error instead of vanishing - a lead disappearing silently is
// the worst failure a landing page has.

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  // The click-to-call beacon arrives as JSON; the form arrives as form data.
  if (type.includes("application/json")) return (await request.json()) as Record<string, unknown>;
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(request: Request) {
  console.log("[lead] in");
  let payload: Record<string, unknown>;
  try {
    payload = await readBody(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the submission." }, { status: 400 });
  }
  const isCall = payload.event === "call_click";

  // The form asks for first and last name as two fields. Most CRMs also want one name field.
  if (!(typeof payload.name === "string" && payload.name.trim()) && (payload.first_name || payload.last_name)) {
    payload.name = `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
  }

  // The honeypot. A filled fax field is a bot: say thanks, send nothing.
  if (!isCall && typeof payload.company_fax === "string" && payload.company_fax.trim()) {
    return NextResponse.redirect(new URL("/thank-you", request.url), 303);
  }
  delete payload.company_fax;

  const webhook = process.env.LEAD_WEBHOOK_URL || site.leadWebhook;
  if (!webhook || !/^https?:\/\//.test(webhook)) {
    console.log("[lead] out - no webhook set");
    return NextResponse.json(
      { ok: false, error: "Lead webhook not connected. Set LEAD_WEBHOOK_URL in website/.env.local." },
      { status: 503 },
    );
  }

  let res: Response;
  try {
    res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        event: payload.event || "form_submit",
        source: "website",
        page: payload.page || request.headers.get("referer") || "",
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.log("[lead] out - webhook unreachable", (err as Error).message);
    return NextResponse.json({ ok: false, error: "Webhook unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    console.log("[lead] out - webhook responded", res.status);
    return NextResponse.json({ ok: false, error: `Webhook responded ${res.status}` }, { status: 502 });
  }

  console.log("[lead] out", isCall ? "call" : "form");
  if (isCall) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/thank-you", request.url), 303);
}
