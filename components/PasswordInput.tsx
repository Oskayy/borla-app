'use client'

import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  className?: string
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  required,
  autoComplete,
  className,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className={className}
        style={{ paddingRight: 60, width: '100%', marginBottom: 0 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: 'absolute',
          right: 10,
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: 12,
          cursor: 'pointer',
          padding: 4,
          lineHeight: 1,
        }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}