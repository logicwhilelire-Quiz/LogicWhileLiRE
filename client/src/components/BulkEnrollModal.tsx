import { useState, useRef } from 'react';
import { bulkEnrollParticipants, getBulkEnrollTemplateUrl, type BulkEnrollResult } from '../lib/api';

interface BulkEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examTitle: string;
  onSuccess?: () => void;
}

export default function BulkEnrollModal({
  isOpen,
  onClose,
  examId,
  examTitle,
  onSuccess,
}: BulkEnrollModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkEnrollResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validExt = selected.name.endsWith('.csv') || selected.name.endsWith('.xlsx');
      if (!validExt) {
        setError('Please upload a valid .csv or .xlsx spreadsheet file.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      const validExt = dropped.name.endsWith('.csv') || dropped.name.endsWith('.xlsx');
      if (!validExt) {
        setError('Please upload a valid .csv or .xlsx spreadsheet file.');
        return;
      }
      setFile(dropped);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a CSV or XLSX file first.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await bulkEnrollParticipants(examId, file);
      setResult(res.data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Bulk enrollment failed.';
      setError(msg);
      if (err.response?.data?.row_errors) {
        setResult({
          success: false,
          message: msg,
          total_uploaded: 0,
          inserted_count: 0,
          skipped_count: 0,
          inserted: [],
          skipped: [],
          validation_warnings: err.response.data.row_errors,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              👥 Bulk Candidate Enrollment
            </h3>
            <p className="text-muted text-xs" style={{ marginTop: 4 }}>
              Target Assessment: <strong style={{ color: 'var(--color-primary)' }}>{examTitle}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 8px', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>

        {/* Instructions & Template Link */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span className="font-bold">Required Columns:</span>{' '}
              <code style={{ color: 'var(--color-primary-light)' }}>Full Name</code>,{' '}
              <code style={{ color: 'var(--color-primary-light)' }}>Hall Ticket</code>,{' '}
              <code style={{ color: 'var(--color-primary-light)' }}>Mobile</code>,{' '}
              <code style={{ color: 'var(--color-primary-light)' }}>Email</code>
            </div>
            <a
              href={getBulkEnrollTemplateUrl()}
              download="logicwhilelire_enrollment_template.csv"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              📥 Download Sample CSV
            </a>
          </div>
        </div>

        {error && (
          <div
            className="banner-danger mb-3"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.85rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              color: '#fca5a5',
              marginBottom: 16,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Result Summary */}
        {result && (
          <div style={{ marginBottom: 20 }}>
            {result.success ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#6ee7b7',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                  🎉 {result.message}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.8rem' }}>
                  <span>✅ Enrolled: <strong>{result.inserted_count}</strong></span>
                  <span>⚠️ Skipped / Duplicates: <strong>{result.skipped_count}</strong></span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>❌ Enrollment Incomplete</div>
                <div style={{ marginTop: 4 }}>{result.message}</div>
              </div>
            )}

            {/* Validation warnings / Row errors */}
            {result.validation_warnings && result.validation_warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="text-muted text-xs font-bold" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                  Row Validation Warnings ({result.validation_warnings.length}):
                </div>
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                  }}
                >
                  {result.validation_warnings.map((w, idx) => (
                    <div key={idx} style={{ color: '#f87171', marginBottom: 4 }}>
                      • Row {w.row} {w.hall_ticket ? `(${w.hall_ticket})` : ''}: {w.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped candidates list */}
            {result.skipped && result.skipped.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="text-muted text-xs font-bold" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                  Skipped Candidates ({result.skipped.length}):
                </div>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                  }}
                >
                  {result.skipped.map((s, idx) => (
                    <div key={idx} style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      • Hall Ticket <strong style={{ color: 'var(--color-text)' }}>{s.hall_ticket}</strong>: {s.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Dropzone */}
        {!result?.success && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 12,
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease',
              marginBottom: 20,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx"
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
            {file ? (
              <div>
                <p style={{ fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>
                  {file.name}
                </p>
                <p className="text-muted text-xs">
                  {(file.size / 1024).toFixed(1)} KB — Ready to upload
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px 0' }}>
                  Click or drag and drop roster file here
                </p>
                <p className="text-muted text-xs">Supports CSV and XLSX spreadsheets (up to 5MB)</p>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {result?.success ? (
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              {file && (
                <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={loading}>
                  Clear
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={!file || loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" /> Enrolling Roster...
                  </>
                ) : (
                  'Upload & Enroll Candidates'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
