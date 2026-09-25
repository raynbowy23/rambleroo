export function Pine({ x, y, size, color = 'currentColor' }: { x: number; y: number; size: number; color?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size / 40})`}
      fill={color}
      d="M-1 3V-4L-14-5-9-10-12-10-6-17-10-16-5-23-7-23 0-40 6-25 4-25 9-18 6-18 12-10 8-11 14-5 1-4V3Z"
    />
  )
}
export function Trees() {
  return (
    <g>
      <Pine x={42} y={67} size={29} />
      <Pine x={58} y={72} size={43} />
      <Pine x={73} y={66} size={27} />
    </g>
  )
}
