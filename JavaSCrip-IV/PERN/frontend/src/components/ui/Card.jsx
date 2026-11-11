export default function Card({ children, className = "" }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-zinc-950 p-4
                 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_60%)]"
    >
      <div
        className={`flex w-full max-w-md flex-col gap-6 rounded-3xl border
                    border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl
                    shadow-black/60 backdrop-blur ${className}`}
      >
        {children}
      </div>
    </div>
  );
}