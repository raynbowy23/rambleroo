import { CONTACT_EMAIL } from './policy'

export function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <span>a contact address that will be published here before Rambleroo leaves its preview</span>
  )
}
