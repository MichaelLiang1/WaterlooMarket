import type { Metadata } from "next";
import { BundleForm } from "@/components/bundle-form";
import { requireVerifiedUser } from "@/lib/auth";
import { toDateInput, todayDate } from "@/lib/format";
import { upcomingTerms } from "@/lib/terms";

export const metadata: Metadata = { title: "Leaving for co-op" };

export default async function NewBundlePage() {
  await requireVerifiedUser("/bundles/new");
  // Default the move-out date to the last day of the current term.
  const currentTerm = upcomingTerms(new Date(), 1)[0];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leaving for co-op? List it all at once.</h1>
        <p className="mt-1 text-sm text-stone-600">
          Add everything you&apos;re selling, set your move-out date, and buyers will know exactly how long
          they have. You can add rentals or more items to the bundle later.
        </p>
      </div>
      <BundleForm defaultMoveOut={currentTerm.end} minDate={toDateInput(todayDate())} />
    </div>
  );
}
