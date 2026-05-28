import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`
          ${sizes[size]}
          rounded-full
          border-gray-200
          border-t-primary
          animate-spin
        `}
        style={{ borderTopColor: 'var(--color-primary, #e11d48)' }}
      ></div>
    </div>
  );
}
