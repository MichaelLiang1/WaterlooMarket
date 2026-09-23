import type { Metadata } from "next";
import { createAlert, deleteAlert, toggleAlert } from "@/app/actions/social";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState } from "@/components/listing-card";
import { Category, ListingKind } from "@/generated/prisma/enums";
import { requireVerifiedUser } from "@/lib/auth";
import { CATEGORY_LABELS, KIND_LABELS, NEIGHBOURHOODS } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Search alerts" };

export default async function AlertsPage(props: PageProps<"/alerts">) {
  const user = await requireVerifiedUser("/alerts");
  const sp = await props.searchParams;
  const alerts = await db.alert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search alerts</h1>
        <p className="text-sm text-stone-600">
          Get notified the moment something matching gets posted — like “desk under $40 near campus”.
        </p>
      </div>
      {sp.created && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">Alert saved.</p>}

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">New alert</h2>
        <ActionForm action={createAlert} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="redirectTo" value="alerts" />
          <Field label="Keyword" name="keyword">
            <input id="keyword" name="keyword" maxLength={60} placeholder="desk" className="input" />
          </Field>
          <Field label="Max price ($)" name="maxPrice">
            <input id="maxPrice" name="maxPrice" inputMode="decimal" placeholder="40" className="input" />
          </Field>
          <Field label="Category" name="category">
            <select id="category" name="category" defaultValue="" className="input">
              <option value="">Any</option>
              {Object.values(Category).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type" name="kind">
            <select id="kind" name="kind" defaultValue="" className="input">
              <option value="">For sale, rent, storage & sublets</option>
              {Object.values(ListingKind).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area" name="neighbourhood" className="sm:col-span-2">
            <select id="neighbourhood" name="neighbourhood" defaultValue="" className="input">
              <option value="">Anywhere</option>
              {NEIGHBOURHOODS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Saving…">Save alert</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {alerts.length === 0 ? (
        <EmptyState title="No alerts yet" />
      ) : (
        <ul className="card divide-y divide-stone-100">
          {alerts.map((a) => {
            const parts = [
              a.keyword && `“${a.keyword}”`,
              a.kind && KIND_LABELS[a.kind],
              a.category && CATEGORY_LABELS[a.category],
              a.maxPriceCents !== null && `under ${formatPrice(a.maxPriceCents)}`,
              a.neighbourhood && `in ${a.neighbourhood}`,
            ].filter(Boolean);
            return (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <p className={`flex-1 text-sm ${a.active ? "" : "text-stone-400 line-through"}`}>{parts.join(" · ")}</p>
                <ActionForm action={toggleAlert} showSuccess={false}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <SubmitButton className="btn-secondary btn-sm">{a.active ? "Pause" : "Resume"}</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteAlert} showSuccess={false}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <SubmitButton className="btn-danger btn-sm">Delete</SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
