// Thin line icons (ink stroke, round caps) on an irregular sage blob, from the mockups.
// Decorative only: every icon sits next to a visible text label.

type IconProps = { size?: number; stroke?: number; blob?: string };

function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

const line = (stroke: number) => ({
  fill: "none",
  stroke: "var(--ink)",
  strokeWidth: stroke,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function BreathingIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="34" cy="34" r="24" fill={blob} />
      <path d="M30 30a4 4 0 1 1 6 3.5 9 9 0 1 1-12-8.5 14 14 0 1 1-12 13" {...line(stroke)} />
    </Svg>
  );
}

export function GroundingIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 30c2-14 16-22 30-18s16 18 10 28-20 14-30 8-12-10-10-18z" fill={blob} />
      <path d="M32 14v6M32 44v6M14 32h6M44 32h6M19 19l4 4M41 41l4 4M45 19l-4 4M23 41l-4 4" {...line(stroke)} />
    </Svg>
  );
}

export function StopIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M10 32c0-14 14-24 28-20s18 16 14 26-18 18-30 14S10 42 10 32z" fill={blob} />
      <rect x="20" y="20" width="24" height="24" rx="6" {...line(stroke)} />
      <path d="M28 32h8" {...line(stroke)} />
    </Svg>
  );
}

export function TipIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 34c2-16 18-24 32-20s18 18 12 28-22 14-32 8S6 42 8 34z" fill={blob} />
      <path d="M14 40l10-10 8 8 18-18M40 20h10v10" {...line(stroke)} />
    </Svg>
  );
}

export function WavesIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 34c2-16 18-24 32-20s18 18 12 28-22 14-32 8S6 42 8 34z" fill={blob} />
      <path
        d="M10 26c5-4 9-4 14 0s9 4 14 0 9-4 14 0M10 36c5-4 9-4 14 0s9 4 14 0 9-4 14 0M10 46c5-4 9-4 14 0s9 4 14 0 9-4 14 0"
        {...line(stroke)}
      />
    </Svg>
  );
}

export function ChatIcon({ size = 64, stroke = 2, blob = "var(--sage)" }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 36c0-16 16-26 30-22s20 18 14 30-22 18-32 12-12-12-12-20z" fill={blob} />
      <path d="M20 20h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H32l-8 7v-7h-4a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" {...line(stroke)} />
    </Svg>
  );
}

export function HeartIcon({ size = 64, stroke = 2.6 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="32" cy="32" r="26" fill="#6F8545" />
      <path
        d="M32 46s-14-8-14-18a7 7 0 0 1 14-4 7 7 0 0 1 14 4c0 10-14 18-14 18z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PhoneIcon({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        d="M6.5 3.5l3 .5 1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5.5 3c0 1.5-1.5 3-3 3A16 16 0 0 1 3.5 6.5c0-1.5 1.5-3 3-3z"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <path d="M7 4l6 6-6 6" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const copingIcons = {
  breathing: BreathingIcon,
  grounding: GroundingIcon,
  stop: StopIcon,
  tip: TipIcon,
  "urge-surfing": WavesIcon,
  "reach-out": ChatIcon,
} as const;
