# The website

A small Next.js site that ships with the repo. The commands fill it in; you never start from a blank page.

- `/build-website` turns it into your four-page site: home, about, privacy policy, terms.
- `/landing-page` copies `app/lp/_template/` into one page per ad group.
- `/publish` puts it live on your own domain through GitHub and Vercel.

Run it yourself any time: `npm install`, then `npm run dev`, then open http://localhost:3000.

`lib/site.config.ts` holds the business name, phone, address and style. Every page reads from it.
`.env.local` holds the lead webhook and the Google tag. Copy `.env.local.example` to make it.
