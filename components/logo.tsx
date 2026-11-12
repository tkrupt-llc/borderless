// Placeholder mark from DESIGN.md: open ring in primary with a clay dot, then the word.
// Replace with the final logo files when available.
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={`flex items-center ${lg ? "gap-2.5" : "gap-2"}`}>
      <svg width={lg ? 38 : 26} height={lg ? 38 : 26} viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M32.3 9.7 A16 16 0 1 0 32.3 30.3"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
      </svg>
      <span
        className={`font-semibold tracking-[-0.01em] text-primary ${lg ? "text-[1.625rem]" : "text-[1.1875rem]"}`}
      >
        borderless
      </span>
    </span>
  );
}
