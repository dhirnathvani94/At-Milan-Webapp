import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="mx-auto h-16 w-16 text-gray-400 mb-4 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="mt-2 text-lg font-bold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button onClick={onAction} variant="primary">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
