import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, id, type = "text", error, className = "", ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className={`w-full rounded-xl border bg-zinc-800/60 px-4 py-2.5
                    text-zinc-100 placeholder-zinc-500 outline-none transition
                    ${
                      error
                        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                        : "border-zinc-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                    } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
});

export default Input;