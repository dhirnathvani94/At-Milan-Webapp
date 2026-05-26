import React from 'react';

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  color?: string;
  size?: 'sm' | 'md';
}

export default function ProgressBar({
  percentage,
  showLabel = false,
  color = 'bg-primary',
  size = 'md',
}: ProgressBarProps) {
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const heightClass = size === 'sm' ? 'h-2' : 'h-4';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-medium text-gray-700">{Math.round(safePercentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${safePercentage}%` }}
        ></div>
      </div>
    </div>
  );
}
