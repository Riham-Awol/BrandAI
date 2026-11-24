import { Suspense } from "react";
import { connection } from "next/server";
import { lookupUnsubscribe } from "@/modules/automation/contacts-service.js";

export const metadata = { title: { absolute: "Email preferences" }, robots: { index: false } };

/** Public unsubscribe page: confirms with a button (link scanners never unsubscribe people by accident). */
export default function UnsubscribePage({ params, searchParams }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f2f7] px-4 text-[#1d1b22]">
      <Suspense fallback={<p>Loading…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }) {
  await connection();
  const [{ token }, q] = await Promise.all([params, searchParams]);
  const info = await lookupUnsubscribe(token);
  const done = q.done === "1" || info?.unsubscribed;
  return (
    <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
      {!info ? (
        <>
          <h1 className="text-xl font-semibold">Link not recognised</h1>
          <p className="text-sm text-[#4a4752]">This unsubscribe link is not valid. If you keep receiving emails, reply to one and ask to be removed.</p>
        </>
      ) : done ? (
        <>
          <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
          <p className="text-sm text-[#4a4752]">You won&apos;t receive marketing emails from {info.businessName} any more.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Unsubscribe from {info.businessName}?</h1>
          <p className="text-sm text-[#4a4752]">You&apos;ll stop receiving their marketing emails.</p>
          <form method="post" action={`/api/v1/unsubscribe/${encodeURIComponent(token)}?redirect=1`}>
            <button type="submit" className="min-h-11 rounded-full bg-[#302442] px-6 py-2.5 text-sm font-semibold text-white">Unsubscribe</button>
          </form>
        </>
      )}
    </div>
  );
}
