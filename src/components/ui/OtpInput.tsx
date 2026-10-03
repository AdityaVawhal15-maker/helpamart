import { useEffect, useRef, useState } from 'react'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  hasError?: boolean
  autoFocus?: boolean
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number>(0)

  // Split value into an array of characters
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  const handleInputChange = (index: number, char: string) => {
    const clean = char.replace(/\D/g, '')
    if (!clean) return

    // If typing a single digit
    const singleDigit = clean.slice(-1)
    const newDigits = [...digits]
    newDigits[index] = singleDigit
    const newValue = newDigits.join('').slice(0, length)
    onChange(newValue)

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }

    if (newValue.length === length && onComplete) {
      onComplete(newValue)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        // Clear current box
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join(''))
      } else if (index > 0) {
        // Move to previous and clear
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        inputRefs.current[index - 1]?.focus()
        setFocusedIndex(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
      setFocusedIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return

    onChange(pasted)
    const nextIndex = Math.min(pasted.length, length - 1)
    inputRefs.current[nextIndex]?.focus()
    setFocusedIndex(nextIndex)

    if (pasted.length === length && onComplete) {
      onComplete(pasted)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-2.5 my-2">
      {Array.from({ length }).map((_, index) => {
        const isCurrent = focusedIndex === index
        const isFilled = Boolean(digits[index])
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[index]}
            disabled={disabled}
            aria-label={`Verification code digit ${index + 1}`}
            autoComplete="one-time-code"
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(index)}
            className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl transition-all duration-150 outline-none
              ${
                hasError
                  ? 'border-2 border-maroon/80 bg-maroon/[0.04] text-maroon focus:ring-2 focus:ring-maroon/20'
                  : isCurrent
                  ? 'border-2 border-navy bg-white text-navy shadow-sm ring-3 ring-navy/10'
                  : isFilled
                  ? 'border border-navy/40 bg-white text-navy'
                  : 'border border-grey-soft bg-ivory-dark/40 text-navy hover:border-grey'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
            `}
          />
        )
      })}
    </div>
  )
}
