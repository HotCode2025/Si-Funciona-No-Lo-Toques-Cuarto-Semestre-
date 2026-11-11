export default function Textarea({ className, ...props }) {
  return (
    <textarea
      className={`flex min-h-20 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-slate-200 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}