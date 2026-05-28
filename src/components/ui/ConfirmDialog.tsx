import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  hideCancel?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  hideCancel = false,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const isPrimary = variant === 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 mb-4 ${isDanger ? 'bg-red-100' : isPrimary ? 'bg-primary-100' : 'bg-yellow-100'}`}>
          <AlertTriangle className={`h-6 w-6 ${isDanger ? 'text-red-600' : isPrimary ? 'text-primary-600' : 'text-yellow-600'}`} aria-hidden="true" />
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        {!hideCancel && (
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
        )}
        <Button variant={isDanger ? 'danger' : 'primary'} onClick={() => {
          onConfirm();
          onClose();
        }}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
