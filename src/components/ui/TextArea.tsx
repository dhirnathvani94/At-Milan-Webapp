import React from 'react';

interface TextAreaProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  error?: string;
  required?: boolean;
  helpText?: string;
  name?: string;
  className?: string;
}

export default function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  error,
  required = false,
  helpText,
  name,
  className = '',
}: TextAreaProps) {
  const textareaId = name || label?.toLowerCase().replace(/\s+/g, '-') || undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const helpId = helpText ? `${textareaId}-help` : undefined;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500" aria-label="required">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          id={textareaId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          className={`
            block w-full rounded-lg border transition-colors p-3
            ${error 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-primary focus:border-primary'}
            bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50
          `}
        />
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400" aria-live="polite">
            {value.length}/{maxLength}
          </div>
        )}
      </div>
      {error && <p id={errorId} className="mt-1 text-sm text-red-500" role="alert">{error}</p>}
      {helpText && !error && <p id={helpId} className="mt-1 text-sm text-gray-500">{helpText}</p>}
    </div>
  );
}
