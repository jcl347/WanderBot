// components/SectionCard.tsx
export default function SectionCard({ children, tight = false }: { children: React.ReactNode; tight?: boolean }) {
  return (
    <section className={`rounded-xl bg-white/95 border p-4 ${tight ? "py-3" : "p-4"}`}>
      {children}
    </section>
  );
}
