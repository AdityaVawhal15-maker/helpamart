import { type ReactNode } from 'react'
import clsx from 'clsx'

type Props = {
  eyebrow?: string
  headline: ReactNode
  subtext?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  size?: 'md' | 'lg' | 'xl'
}

export function SectionHeading({ eyebrow, headline, subtext, align = 'center', className, size = 'lg' }: Props) {
  return (
    <div className={clsx(
      'flex flex-col gap-3',
      align === 'center' && 'items-center text-center',
      align === 'left' && 'items-start text-left',
      align === 'right' && 'items-end text-right',
      className
    )}>
      {eyebrow && (
        <p className="text-xs font-bold tracking-[0.14em] uppercase text-gold flex items-center gap-2">
          <span className="w-5 h-px bg-gold inline-block" />
          {eyebrow}
          <span className="w-5 h-px bg-gold inline-block" />
        </p>
      )}
      <h2 className={clsx(
        'text-navy font-display',
        size === 'md' && 'text-display-md',
        size === 'lg' && 'text-display-lg',
        size === 'xl' && 'text-display-xl',
      )}>
        {headline}
      </h2>
      {subtext && (
        <p className="text-grey leading-relaxed max-w-xl">
          {subtext}
        </p>
      )}
    </div>
  )
}
