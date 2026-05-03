/**
 * Outline of the IVAS visor as seen from the wearer's perspective.
 *
 * Pure presentation: black periphery, lens viewing area in the centre,
 * sensor pod silhouette above. Future HUD widgets (compass, waypoints,
 * squad markers, threat icons) overlay on top of this frame.
 *
 * The internal viewBox is 1600x900 (16:9). The component fills its parent
 * and the visor scales while staying centred via `preserveAspectRatio`.
 */
export default function HudLensFrame() {
  return (
    <svg
      viewBox="0 0 1600 900"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="IVAS visor outline"
    >
      <defs>
        <radialGradient id="hud-lens-tint" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#02060f" />
          <stop offset="70%" stopColor="#030712" />
          <stop offset="100%" stopColor="#0b1220" />
        </radialGradient>
        <linearGradient id="hud-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(125 211 252 / 0.55)" />
          <stop offset="55%" stopColor="rgb(148 163 184 / 0.55)" />
          <stop offset="100%" stopColor="rgb(71 85 105 / 0.35)" />
        </linearGradient>
        <linearGradient id="hud-pod" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
      </defs>

      {/* mounting strap suggestion: faint lines running off to the helmet sides */}
      <line
        x1="60"
        y1="160"
        x2="470"
        y2="160"
        stroke="rgb(71 85 105 / 0.35)"
        strokeWidth="2"
      />
      <line
        x1="1130"
        y1="160"
        x2="1540"
        y2="160"
        stroke="rgb(71 85 105 / 0.35)"
        strokeWidth="2"
      />

      {/* sensor housing on top of the visor */}
      <rect
        x="470"
        y="118"
        width="660"
        height="86"
        rx="26"
        fill="url(#hud-pod)"
        stroke="rgb(148 163 184 / 0.45)"
        strokeWidth="2"
      />
      {[
        { cx: 600, r: 13 },
        { cx: 680, r: 17 },
        { cx: 760, r: 20 },
        { cx: 840, r: 20 },
        { cx: 920, r: 17 },
        { cx: 1000, r: 13 },
      ].map((c) => (
        <g key={c.cx}>
          <circle
            cx={c.cx}
            cy="161"
            r={c.r}
            fill="#020617"
            stroke="rgb(148 163 184 / 0.55)"
            strokeWidth="1.25"
          />
          <circle cx={c.cx} cy="161" r={Math.max(2, c.r - 8)} fill="rgb(56 189 248 / 0.18)" />
        </g>
      ))}

      {/* visor body / lens viewing area */}
      <rect
        x="180"
        y="200"
        width="1240"
        height="520"
        rx="260"
        fill="url(#hud-lens-tint)"
        stroke="url(#hud-rim)"
        strokeWidth="3"
      />

      {/* binocular projection hint: two faint inner lens regions */}
      <ellipse
        cx="660"
        cy="460"
        rx="330"
        ry="230"
        fill="none"
        stroke="rgb(125 211 252 / 0.1)"
        strokeWidth="1.25"
      />
      <ellipse
        cx="940"
        cy="460"
        rx="330"
        ry="230"
        fill="none"
        stroke="rgb(125 211 252 / 0.1)"
        strokeWidth="1.25"
      />

      {/* nose-bridge silhouette at the lower centre */}
      <path
        d="M 740 720 Q 800 762 860 720"
        fill="none"
        stroke="rgb(71 85 105 / 0.55)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
