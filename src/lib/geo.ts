/** Haversine distance in miles between [longitude, latitude] centers. */
export function greatCircleMiles(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * radians) / 2) ** 2 +
    Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(((b[0] - a[0]) * radians) / 2) ** 2
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
