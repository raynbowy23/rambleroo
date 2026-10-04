import { ISSUES_URL } from './policy'

/** Contact goes through public GitHub issues; pages using this also warn not to post personal details. */
export function Contact() {
  return (
    <a href={ISSUES_URL} target="_blank" rel="noreferrer">
      an issue on GitHub
    </a>
  )
}
