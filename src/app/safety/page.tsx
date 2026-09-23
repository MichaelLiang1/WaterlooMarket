import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Safety tips" };

const TIPS = [
  ["Meet in public", "Pick busy spots — the SLC, DC, a residence front desk, or a coffee shop. Bring a friend for big items."],
  ["Inspect before you pay", "Test electronics, check furniture for damage or bed bugs, and confirm the item matches the photos."],
  ["Never share your exact address in a listing", "Listings only show a general area. Share details privately once you've agreed on a pickup."],
  ["Deposits are handled in person", "Get a written or messaged record of the deposit amount and when it'll be returned. Waterloo Market doesn't hold money."],
  ["Avoid prepaying strangers", "Be wary of anyone asking for e-transfers before you've seen the item, or who wants to move off-platform right away."],
  ["Report anything off", "Use the ⚑ Report link on any listing, message thread, or profile. Moderators review every report."],
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Staying safe on Waterloo Market</h1>
      <ul className="space-y-3">
        {TIPS.map(([title, body]) => (
          <li key={title} className="card p-4">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-stone-700">{body}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-stone-600">
        Some items can&apos;t be listed at all. See{" "}
        <Link href="/terms" className="link">
          what you can&apos;t post
        </Link>
        .
      </p>
    </div>
  );
}
