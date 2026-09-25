import s from '../../components/ui/Content.module.css'
export function PassportBook() {
  return (
    <svg className={s.book} viewBox="0 0 210 280" role="img" aria-label="Illustration: green Rambleroo Passport book">
      <rect x="6" y="4" width="198" height="270" rx="10" fill="#173c30" />
      <path d="M17 5v268" stroke="#0d2c23" strokeWidth="5" />
      <rect x="24" y="16" width="168" height="245" rx="5" fill="none" stroke="#b9a573" strokeDasharray="2 3" opacity=".65" />
      <g fill="#d7bf83" textAnchor="middle" fontFamily="var(--font-serif)">
        <text x="108" y="65" fontSize="23">
          Rambleroo
        </text>
        <text x="108" y="93" fontSize="19">
          Passport
        </text>
        <path d="m108 121-17 27h10l-23 29h17l-24 30h30v18h14v-18h30l-24-30h17l-23-29h10Z" />
        <text x="108" y="248" fontSize="6.5" letterSpacing=".7">
          SCENIC ROADS · WANDERED WELL
        </text>
      </g>
    </svg>
  )
}
