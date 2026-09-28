import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface ViolationEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  snapshot_thumb?: string | null;
  count: number;
  is_false_positive?: boolean;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

interface CandidateViolationTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptId: string;
  candidateName?: string;
  hallTicket?: string;
  adminToken?: string;
}

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CandidateViolationTimelineModal({
  isOpen,
  onClose,
  attemptId,
  candidateName,
  hallTicket,
  adminToken,
}: CandidateViolationTimelineModalProps) {
  const [timeline, setTimeline] = useState<ViolationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTimeline = async () => {
    if (!attemptId) return;
    setLoading(true);
    setError('');
    try {
      const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
      const res = await axios.get(`${BASE}/api/admin/attempts/${attemptId}/violations`, {
        headers,
        withCredentials: true,
      });
      if (res.data?.success) {
        setTimeline(res.data.attempt?.timeline || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && attemptId) {
      fetchTimeline();
    }
  }, [isOpen, attemptId]);

  const handleToggleFalsePositive = async (violation: ViolationEvent) => {
    setUpdatingId(violation.id);
    try {
      const newStatus = !violation.is_false_positive;
      const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
      const res = await axios.patch(
        `${BASE}/api/admin/attempts/${attemptId}/violations/${violation.id}/review`,
        {
          is_false_positive: newStatus,
          review_notes: newStatus ? 'Marked as false positive by admin' : 'Confirmed strike by admin',
        },
        { headers, withCredentials: true }
      );
      if (res.data?.success) {
        setTimeline((prev) =>
          prev.map((v) => (v.id === violation.id ? { ...v, is_false_positive: newStatus } : v))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update review status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'multiple_faces':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'no_face':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'looking_away':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'tab_switch':
      case 'window_blur':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'devtools':
        return 'bg-red-600/20 text-red-400 border-red-600/40';
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-850/60 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xl">📋</span>
                <h3 className="text-lg font-bold text-white">
                  Proctoring Violation Timeline
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Candidate: <strong className="text-slate-200">{candidateName || hallTicket}</strong> ({hallTicket})
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Timeline Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading timeline...</div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <span className="text-3xl">🛡️</span>
                <p className="text-slate-300 font-medium">No violations recorded for this candidate.</p>
                <p className="text-xs text-slate-500">The session maintained full integrity.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      item.is_false_positive
                        ? 'bg-slate-950/40 border-slate-800/80 opacity-60'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${getBadgeStyle(
                              item.type
                            )}`}
                          >
                            {item.type.replace(/_/g, ' ')}
                          </span>
                          {item.is_false_positive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ False Positive (Overridden)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200">{item.message}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString()} ·{' '}
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      {item.snapshot_thumb && (
                        <button
                          onClick={() => setSelectedSnapshot(item.snapshot_thumb!)}
                          className="w-16 h-12 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors relative group"
                        >
                          <img
                            src={item.snapshot_thumb}
                            alt="Evidence Snapshot"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-black/40 group-hover:bg-black/10 flex items-center justify-center text-[10px] text-white">
                            🔍
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleFalsePositive(item)}
                        disabled={updatingId === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          item.is_false_positive
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {updatingId === item.id
                          ? 'Updating...'
                          : item.is_false_positive
                          ? 'Undo Override'
                          : 'Mark False Positive'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Snapshot Modal */}
          {selectedSnapshot && (
            <div
              onClick={() => setSelectedSnapshot(null)}
              className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 cursor-zoom-out"
            >
              <div className="max-w-md w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Proctoring Audit Evidence Thumbnail</span>
                  <span>Click anywhere to dismiss</span>
                </div>
                <img
                  src={selectedSnapshot}
                  alt="Full Evidence"
                  className="w-full rounded-xl border border-slate-800"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-850/60 flex items-center justify-between text-xs text-slate-400">
            <span>
              Total Events: {timeline.length} | Active Strikes:{' '}
              {timeline.filter((t) => !t.is_false_positive).length}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
