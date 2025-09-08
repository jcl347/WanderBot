// components/BackgroundMap.tsx
export default function BackgroundMap({
  children,
  tintClass = "bg-white/75 backdrop-blur-sm",
}: {
  children: React.ReactNode;
  tintClass?: string; // allow tweaks per page if needed
}) {
  return (
    <div
      className="min-h-screen w-full relative z-0"
      style={{
        backgroundImage: `url("https://tile.openstreetmap.org/0/0/0.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay sits behind everything and doesn't intercept clicks */}
      <div className={`absolute inset-0 -z-10 pointer-events-none ${tintClass}`} aria-hidden="true" />
      {/* All page content lives above */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:py-10">
        {children}
      </div>
    </div>
  );
}
