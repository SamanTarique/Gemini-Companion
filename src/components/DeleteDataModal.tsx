import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { deleteUserAllData } from '../lib/firebase';

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onDataDeleted: () => void;
}

export const DeleteDataModal: React.FC<DeleteDataModalProps> = ({
  isOpen,
  onClose,
  userId,
  onDataDeleted,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmationInput !== 'DELETE') {
      setError('Please type DELETE exactly to confirm.');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await deleteUserAllData(userId);
      onDataDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        id="delete-data-modal"
        className="bg-[#0F0F0F] border border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-zinc-100"
      >
        <div className="p-6 border-b border-zinc-800 bg-[#0A0A0A] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-950/60 border border-rose-800/60 text-rose-400 rounded-xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Delete All Account Data</h3>
              <p className="text-xs text-zinc-400">Permanent data purge from Firestore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-rose-950/30 border border-rose-900/50 rounded-2xl flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-200/90 leading-relaxed">
              <strong className="text-rose-300">Warning:</strong> This action cannot be undone. All your past journal entries, AI reflections, extracted schedules, and saved tags under <code className="font-mono text-zinc-300 bg-zinc-950 px-1 py-0.5 rounded">/users/{userId}</code> will be permanently destroyed.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">
              Type <strong className="font-mono text-rose-400">DELETE</strong> to confirm:
            </label>
            <input
              id="confirm-delete-input"
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-400 bg-rose-950/40 rounded-lg border border-rose-900/60">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-[#0A0A0A] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-button"
            type="button"
            onClick={handleDelete}
            disabled={confirmationInput !== 'DELETE' || isDeleting}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-rose-700 text-white hover:bg-rose-600 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
