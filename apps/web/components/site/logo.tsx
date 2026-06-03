/** Fakebase mark: a stacked-cylinder "database" silhouette with a dashed top
 *  disc — a real DB stack, but the top layer is dotted to signal "faked / local". */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="7" ry="2.6" strokeDasharray="2.2 2.2" />
      <path d="M5 5v6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6V5" />
      <path d="M5 11v6c0 1.44 3.13 2.6 7 2.6s7-1.16 7-2.6v-6" />
    </svg>
  );
}
