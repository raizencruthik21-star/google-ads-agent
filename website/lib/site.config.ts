// THE ONE FILE TO EDIT FIRST.
// Every page reads from here - /build-website asks the questions and fills it in.

export const site = {
  name: "Your Business Name",
  tagline: "What you do, in one plain sentence",
  // Fallback only. The lead webhook lives in LEAD_WEBHOOK_URL (website/.env.local, and the Vercel
  // project once live) so it never ships to the browser. /landing-page sets it.
  leadWebhook: null as string | null,
  phone: "(555) 555-5555",
  email: "hello@example.com",
  address: "123 Main St, Your City",
  city: "Your City",
  url: "https://example.com", // your live domain - used by sitemap + metadata

  // ⛔ GOOGLE'S BRAND VERIFICATION OPENS YOUR SITE AND LOOKS FOR THREE THINGS:
  // an About page with real background, a physical address, and a privacy policy with
  // real detail. These fields are what fill them. Every page shows a red NOT READY
  // banner until they hold real values - a site with the banner up fails the review.
  founded: "",            // "2011" - the year the business started trading
  owner: "",              // "Dana Whitfield" - who runs it, named on the About page
  story: "",              // 2-3 plain sentences: why it started, who it serves, what is different
  credentials: [] as string[],  // "Licensed electrician, EC-44821", "Fully insured to $5M"
  legalEntity: "",        // "Whitfield Electrical Ltd" - the registered name, for the footer
  // "bold" for trades and home services, "calm" for professional services.
  // /build-website asks which one and writes it here.
  style: "bold" as "bold" | "calm",
  legalName: "",          // alias used by the footer and the legal pages

  // Your three or four services, one line each.
  services: [
    { name: "Service One", slug: "service-one", blurb: "One line on what this is." },
    { name: "Service Two", slug: "service-two", blurb: "One line on what this is." },
    { name: "Service Three", slug: "service-three", blurb: "One line on what this is." },
  ],
};
