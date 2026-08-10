import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

interface PasswordFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  minLength?: number
  inputMode?: 'numeric' | undefined
  required?: boolean
  label?: string
}

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  minLength,
  inputMode,
  required,
  label,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <label>
      {label}
      <span className="password-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          minLength={minLength}
          inputMode={inputMode}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </span>
    </label>
  )
}
