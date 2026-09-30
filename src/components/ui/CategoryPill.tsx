import clsx from 'clsx'
import type { ReactNode } from 'react'

type Props = {
  active?: boolean
  onClick?: () => void
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function CategoryPill({ active, onClick, icon, children, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'pill',
        active && 'pill-active',
        className
      )}
      aria-pressed={active}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
