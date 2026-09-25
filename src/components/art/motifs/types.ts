/** The same six inks are shared by terrain, vegetation and landmarks. */
export interface Inks {
  paper: string
  far: string
  mid: string
  dark: string
  accent: string
  water: string
}
export interface MotifProps {
  inks: Inks
  lighthouse?: boolean
}
