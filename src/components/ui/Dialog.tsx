import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import s from './Dialog.module.css'
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLElement>('input,button,a,textarea')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previous
      opener?.focus()
    }
  }, [])
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
  }, [title])
  return createPortal(
    <dialog
      ref={ref}
      className={s.dialog}
      aria-modal="true"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
        if (e.key === 'Tab') {
          const items = Array.from(
            ref.current!.querySelectorAll<HTMLElement>(
              'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
            ),
          )
          const first = items[0]
          const last = items.at(-1)
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }}
    >
      <div className={s.heading}>
        <h2 id={id}>{title}</h2>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  )
}
