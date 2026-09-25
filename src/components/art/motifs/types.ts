/** The same six inks are shared by terrain, vegetation and landmarks. */
export interface Inks {
  paper: string
  far: string
  mid: string
  dark: string
  accent: string
  water: string
  /** Optional warm window ink for evening scenes. */
  window?: string
}
export interface MotifProps {
  inks: Inks
  lighthouse?: boolean
}
