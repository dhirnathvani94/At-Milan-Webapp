import React from 'react';
import { ShieldCheck, Star } from 'lucide-react';

interface BadgeProps {
  variant: 'verified' | 'premium' | 'new' | 'online' | 'offline' | 'pending' | 'accepted' | 'declined' | 'primary' | 'success' | 'warning' | 'danger';
  text?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function Badge({ variant, text, children, className = '' }: BadgeProps) {
  const baseClasses = `inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`;
  const content = children || text;
  
  switch (variant) {
    case 'primary':
      return (
        <span className={`${baseClasses} bg-primary/10 text-primary`}>
          {content}
        </span>
      );
    case 'success':
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
          {content}
        </span>
      );
    case 'warning':
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          {content}
        </span>
      );
    case 'danger':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-800`}>
          {content}
        </span>
      );
    case 'verified':
      return (
        <span className={`${baseClasses} bg-blue-100 text-blue-800`}>
          <ShieldCheck size={12} className="mr-1" />
          {content || 'Verified'}
        </span>
      );
    case 'premium':
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          <Star size={12} className="mr-1 fill-current" />
          {content || 'Premium'}
        </span>
      );
    case 'new':
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
          {content || 'New'}
        </span>
      );
    case 'online':
      return (
        <span className="flex items-center">
          <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
          <span className="text-xs text-gray-600">{content || 'Online'}</span>
        </span>
      );
    case 'offline':
      return (
        <span className="flex items-center">
          <span className="h-2 w-2 rounded-full bg-gray-400 mr-1.5"></span>
          <span className="text-xs text-gray-600">{content || 'Offline'}</span>
        </span>
      );
    case 'pending':
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          {content || 'Pending'}
        </span>
      );
    case 'accepted':
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
          {content || 'Accepted'}
        </span>
      );
    case 'declined':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-800`}>
          {content || 'Declined'}
        </span>
      );
    default:
      return null;
  }
}
