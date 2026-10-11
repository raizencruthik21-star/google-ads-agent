import { site } from "@/lib/site.config";

// A dead end loses a customer who was already looking for you.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">That page has moved or never existed</h1>
      <p className="mt-3 text-gray-600">Here's where most people were heading:</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href="/" className="underline">Home</a>
        <a href="/about" className="underline">About</a>
      </div>
      <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}
        className="mt-8 inline-block rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white">
        Or just call {site.phone}
      </a>
    </div>
  );
}
