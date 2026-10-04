/** Top view of a car ferry, bow up like the car, same 60 × 100 frame so it drops into the ribbon and progress bar unchanged.
 *  Your car rides on the foredeck in its own colour. */
export function Ship({ size = 30, body = '#c8412f' }: { size?: number; body?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 60 100"
      width={size}
      height={(size * 100) / 60}
      role="img"
      aria-label="Car ferry"
      data-vehicle="ship"
    >
      <g stroke="#252b22" strokeWidth="2.2" strokeLinejoin="round">
        {/* Hull with a pointed bow and square stern. */}
        <path d="M30 2C43 16 48 34 48 54V95H12V54C12 34 17 16 30 2Z" fill="#f4efe1" />
        {/* Car deck, your car parked on it. */}
        <path d="M18 26H42V50H18Z" fill="#d9d2bd" strokeWidth="1.4" />
        <rect x="24" y="29" width="12" height="18" rx="3" fill={body} strokeWidth="1.6" />
        {/* Superstructure, bridge windows and funnel. */}
        <rect x="16" y="56" width="28" height="30" rx="3" fill="#e6dfca" />
        <path d="M20 61H40" strokeWidth="3" stroke="#3f5a63" />
        <circle cx="30" cy="74" r="6" fill="#9c4b40" />
        <circle cx="30" cy="74" r="2.4" fill="#252b22" />
      </g>
    </svg>
  )
}
