// components/PreferencesForm.tsx
"use client";

import React from "react";

type FormValues = {
  budget?: string;
  climate?: string;
  vibe?: string;
  homeAirport?: string;
  photoStyle?: string;
  targetDate?: string;   // we store first-of-month server-side
  vacationType?: string;
};

export default function PreferencesForm() {
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<FormValues>({});

  // Load existing profile on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setValues(data || {});
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
    } catch (err) {
      console.error(err);
      setSaving(false);
      alert("Oops, couldn’t save. Try again?");
      return;
    }

    setSaving(false);

    // Build a starter prompt for the assistant
    const prompt =
      `Here are my travel prefs — budget: ${body.budget || "unspecified"}, ` +
      `climate: ${body.climate || "unspecified"}, vibe: ${body.vibe || "unspecified"}, ` +
      `home airport: ${body.homeAirport || "unspecified"}, photo style: ${body.photoStyle || "unspecified"}, ` +
      `target date: ${body.targetDate || "unspecified"}, vacation type: ${body.vacationType || "unspecified"}.\n` +
      `Please suggest 2–3 options that match, include why they fit my vibe, rough total cost, ` +
      `best timing, and 5–8 photo keywords.`;

    window.dispatchEvent(new CustomEvent("wander:start", { detail: { prompt } }));
    document.querySelector('[data-chat-root]')?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <form onSubmit={onSave} className="space-y-3">
      <input name="budget" defaultValue={values.budget ?? ""} placeholder="Budget"
             className="border p-2 rounded w-full" />
      <input name="climate" defaultValue={values.climate ?? ""} placeholder="Climate"
             className="border p-2 rounded w-full" />
      <input name="vibe" defaultValue={values.vibe ?? ""} placeholder="Vibe"
             className="border p-2 rounded w-full" />
      <input name="homeAirport" defaultValue={values.homeAirport ?? ""} placeholder="Home airport"
             className="border p-2 rounded w-full" />
      <input name="photoStyle" defaultValue={values.photoStyle ?? ""} placeholder="Photo style"
             className="border p-2 rounded w-full" />
      <input name="targetDate" defaultValue={values.targetDate ?? ""} placeholder="Target month (YYYY-MM)"
             className="border p-2 rounded w-full" />
      <input name="vacationType" defaultValue={values.vacationType ?? ""} placeholder="Vacation type"
             className="border p-2 rounded w-full" />

      <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-black text-white">
        {saving ? "Saving…" : "Save & Ask Wander Bot"}
      </button>
    </form>
  );
}
