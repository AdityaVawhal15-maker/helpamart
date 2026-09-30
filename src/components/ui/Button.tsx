import { ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'outline-gold'
  size?: 'sm' | 'md' | 'lg'
  to?: string
  href?: string
  loading?: boolean
  arrow?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  loading,
  className,
  children,
  disabled,
  arrow,
  ...props
}: Props) {
  const styles = clsx(
    'group/btn inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 disabled:cursor-not-allowed',
    // Sizes
    size === 'sm' && 'rounded-lg px-4 py-2 text-sm',
    size === 'md' && 'rounded-xl px-5 py-2.5 text-sm',
    size === 'lg' && 'rounded-xl px-7 py-3.5 text-base',
    // Variants
    variant === 'primary' &&
      'bg-navy text-white hover:bg-navy-mid hover:shadow-[0_8px_24px_rgba(7,26,53,0.22)]',
    variant === 'secondary' &&
      'border border-navy/15 bg-white text-navy hover:border-gold/60 hover:bg-ivory-dark/80',
    variant === 'ghost' && 'text-navy hover:text-gold bg-transparent',
    variant === 'gold' && 'bg-gold text-white hover:bg-gold-mid hover:shadow-[0_6px_20px_rgba(183,122,34,0.3)]',
    variant === 'outline-gold' &&
      'border border-gold text-gold hover:bg-gold hover:text-white',
    className,
  )

  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
      {arrow && !loading && (
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
      )}
    </>
  )

  if (to) {
    return <Link to={to} className={styles}>{content}</Link>
  }
  if (href) {
    return <a href={href} className={styles}>{content}</a>
  }
  return (
    <button className={styles} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
}

export function ArrowCta({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1.5" />
    </>
  )
}
