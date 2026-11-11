export default function Button({ children, styles = "", ...props }) {
  return (
    <button
      className={`w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white
                 transition hover:bg-indigo-500 focus:outline-none
                 focus:ring-2 focus:ring-indigo-400/50 active:scale-[0.98]
                 disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
      {...props}
    >
      {children}
    </button>
  );
}