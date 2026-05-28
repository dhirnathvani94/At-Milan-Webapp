import React, { useState } from 'react';
import { Flag, X, AlertTriangle, Send } from 'lucide-react';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note: string) => Promise<void>;
  reportedUserName: string;
}

const REPORT_REASONS = [
  'Fake Profile / Catfishing',
  'Inappropriate Behaviour',
  'Harassment / Abusive Language',
  'Spam or Scam',
  'Shared Inappropriate Photos',
  'Asking for Money',
  'Already Married',
  'Underage User',
  'Threatening or Blackmailing',
  'Other'
];

export default function ReportUserModal({ isOpen, onClose, onSubmit, reportedUserName }: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, note);
      // Reset state after successful submit
      setSelectedReason('');
      setNote('');
    } catch (err) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
              <Flag size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Report User</h3>
              <p className="text-white/80 text-xs">Report {reportedUserName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white transition p-1 hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Reporting a user will <strong>permanently block</strong> all communication between you. 
            You will no longer be able to message each other or view contact details. 
            Our admin team will review your report.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
          {/* Reason Selection */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-800 mb-3">
              Why are you reporting this user? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'bg-red-50 border-red-300 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 accent-red-600"
                  />
                  <span className={`text-sm font-medium ${
                    selectedReason === reason ? 'text-red-700' : 'text-gray-700'
                  }`}>
                    {reason}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Note */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Additional Details <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide any additional context or details about your report..."
              className="w-full border border-gray-300 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none resize-none transition-all"
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right mt-1">{note.length}/1000</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-5 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || submitting}
            className="flex-1 bg-red-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-600/20"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
