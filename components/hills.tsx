// Flat SVG landscape (decorative). Light on purpose: no photos on patient pages.

export function HillsBanner() {
  return (
    <div className="mx-5 mt-5 h-[110px] overflow-hidden rounded-[22px] bg-sage-mist">
      <svg viewBox="0 0 350 110" width="100%" height="110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <circle cx="270" cy="36" r="18" fill="#F7F4EE" />
        <path d="M0 70 C60 44 120 56 170 64 C230 74 280 46 350 54 L350 110 L0 110Z" fill="#D7DEC4" />
        <path d="M0 88 C70 72 130 78 200 88 C260 96 310 80 350 84 L350 110 L0 110Z" fill="#BCC9A3" />
        <ellipse cx="60" cy="80" rx="8" ry="26" fill="#8FA175" />
        <ellipse cx="78" cy="86" rx="6" ry="19" fill="#8FA175" />
        <path d="M0 100 C90 94 190 98 350 98 L350 110 L0 110Z" fill="#9CAE80" />
      </svg>
    </div>
  );
}

export function HillsHero() {
  return (
    <div className="mt-12 h-[200px] overflow-hidden rounded-[28px] bg-sage-soft sm:h-[320px]">
      <svg viewBox="0 0 1120 320" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <rect width="1120" height="320" fill="#EEF0E4" />
        <circle cx="820" cy="96" r="44" fill="#F7F4EE" />
        <path d="M0 190 C160 120 300 150 430 170 C560 190 660 110 820 120 C960 130 1040 170 1120 150 L1120 320 L0 320Z" fill="#D7DEC4" />
        <path d="M0 230 C140 190 260 200 380 222 C520 248 640 190 780 196 C920 202 1020 236 1120 220 L1120 320 L0 320Z" fill="#BCC9A3" />
        <g fill="#8FA175">
          <ellipse cx="120" cy="214" rx="16" ry="58" />
          <ellipse cx="156" cy="226" rx="12" ry="44" />
          <ellipse cx="930" cy="208" rx="18" ry="64" />
          <ellipse cx="968" cy="224" rx="12" ry="46" />
          <ellipse cx="1004" cy="232" rx="9" ry="34" />
        </g>
        <path d="M0 268 C180 244 320 252 500 270 C660 286 820 250 980 258 C1050 262 1090 270 1120 266 L1120 320 L0 320Z" fill="#9CAE80" />
        <g fill="#6E8458">
          <ellipse cx="300" cy="262" rx="14" ry="40" />
          <ellipse cx="330" cy="272" rx="9" ry="28" />
          <ellipse cx="760" cy="258" rx="15" ry="44" />
        </g>
        <path d="M0 300 C220 286 420 292 620 302 C820 312 980 296 1120 298 L1120 320 L0 320Z" fill="#7F9466" />
      </svg>
    </div>
  );
}
