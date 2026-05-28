import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: boolean;
}

export default function Card({
  children,
  className = '',
  onClick,
  hover = false,
  padding = true,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-md
        ${padding ? 'p-6' : ''}
        ${hover ? 'hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
