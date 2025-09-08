// components/SectionCard.tsx
import React from "react";

export default function SectionCard({
  children,
  className = "",
  tight = false,
}: { children: React.ReactNode; className?: string; tight?: boolean }) {
  return (
    <section
      className={[
        "rounded-2xl border bg-white/90 backdrop-blur shadow-sm",
        tight ? "p-4" : "p-6",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
