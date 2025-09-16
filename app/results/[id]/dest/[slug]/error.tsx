"use client";

import { useEffect } from "react";

export default function DestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log to the browser console for local debugging
  // and POST to Vercel logs so you can see details in production.
  useEffect(() => {
    // 1) Browser console
    // eslint-disable-next-line no-console
    console.error("[DestDetail error]", { message: error.message, digest: error.digest, stack: error.stack });

    // 2) Send to server -> shows in Vercel function logs
    fetch("/api/client-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "dest-detail",
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="rounded-xl border bg-white/90 p-4">
      <h2 className="text-lg font-semibold">We hit a snag loading this destination.</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Our logs captured the details so we can fix it. You can try again:
      </p>
      <button
        onClick={() => reset()}
        className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
      >
        Retry
      </button>
    </div>
  );
}
