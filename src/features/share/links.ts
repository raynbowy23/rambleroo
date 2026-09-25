export function buildShareLinks({ url, title, text }: { url: string; title: string; text: string }) {
  const query = (values: Record<string, string>) => new URLSearchParams(values).toString()
  return {
    email: `mailto:?${query({ subject: title, body: `${text}\n\n${url}` })}`,
    x: `https://twitter.com/intent/tweet?${query({ text, url })}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?${query({ u: url })}`,
    bluesky: `https://bsky.app/intent/compose?${query({ text: `${text}\n${url}` })}`,
    reddit: `https://www.reddit.com/submit?${query({ url, title: text })}`,
  }
}
