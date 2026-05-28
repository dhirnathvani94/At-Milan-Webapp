import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  name,
  className = '',
}: SelectProps) {
  const selectId = name || label?.toLowerCase().replace(/\s+/g, '-') || undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500" aria-label="required">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`
            block w-full rounded-lg border appearance-none transition-colors
            pl-3 pr-10 py-2
            ${error 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-primary focus:border-primary'}
            ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:ring-opacity-50
          `}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500" aria-hidden="true">
          <ChevronDown size={18} />
        </div>
      </div>
      {error && <p id={errorId} className="mt-1 text-sm text-red-500" role="alert">{error}</p>}
    </div>
  );
}
