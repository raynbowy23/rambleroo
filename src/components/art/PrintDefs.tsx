/** Tiny local patterns keep standalone SVGs portable and IDs safe across roots. */
export function PrintDefs({ id, ink, paper }: { id: string; ink: string; paper: string }) {
  return (
    <>
      <pattern id={`${id}-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".65" fill={ink} opacity=".12" />
      </pattern>
      <pattern id={`${id}-grain`} width="9" height="11" patternUnits="userSpaceOnUse">
        <path d="M1 2h1M6 8h.5" stroke={ink} strokeWidth=".5" opacity=".08" />
        <path d="M2 7h1M7 3h1" stroke={paper} strokeWidth=".8" opacity=".22" />
      </pattern>
    </>
  )
}
