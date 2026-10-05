import './art.css'
import logo from '../../assets/brand/logo.png'
import mark from '../../assets/brand/mark.png'

/** The Rambleroo logo: the script wordmark with sun, peaks and road, or just the "R" mark (also the favicon). `size` is the height in px. */
export function Logo({ size = 32, withWordmark = true, className }: { size?: number; withWordmark?: boolean; className?: string }) {
  return withWordmark ? (
    <img className={`rr-logo ${className ?? ''}`} src={logo} alt="Rambleroo" height={size} width={Math.round((size * 241) / 144)} />
  ) : (
    <img className={`rr-logo ${className ?? ''}`} src={mark} alt="Rambleroo" height={size} width={size} />
  )
}
