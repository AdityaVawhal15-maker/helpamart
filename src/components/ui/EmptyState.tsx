import type { ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  icon?: ReactNode
  title: string
  body: string
  cta?: {
    label: string
    to?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon, title, body, cta }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6 max-w-md mx-auto">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-ivory-dark flex items-center justify-center mb-6 text-gold">
          {icon}
        </div>
      )}
      <h3 className="text-display-md text-navy mb-3">{title}</h3>
      <p className="text-grey leading-relaxed mb-8">{body}</p>
      {cta && (
        <Button
          variant="primary"
          size="lg"
          to={cta.to}
          onClick={cta.onClick}
          arrow
        >
          {cta.label}
        </Button>
      )}
    </div>
  )
}
