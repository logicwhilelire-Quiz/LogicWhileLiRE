import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, getExcelReportUrl, getPdfReportUrl } from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  useEffect(() => {
    listExams().then((r) => setExams(r.data.exams));
  }, []);

  return (
    <AnimatedPage>
      <div className="admin-layout">
        <AdminSidebar activeTab="results" />

      <main className="admin-content">
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Reports & Exports</h1>
        <p className="text-muted text-sm mb-3">Download per-participant results, topic breakdowns, and violation logs.</p>

        <div className="form-group" style={{ maxWidth: 400, marginBottom: 32 }}>
          <label className="form-label">Select Exam</label>
          <select
            id="reports-exam-select"
            className="form-input"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">-- Choose an exam --</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        {selectedExamId && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {/* Excel Report */}
            <div className="card animate-slide-up">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Excel Report</h3>
              <p className="text-muted text-sm mb-3">
                Complete per-participant results with topic-wise score breakdown and violations log in a single .xlsx file.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>📋 Results sheet</div>
                <div className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>🚨 Violations sheet</div>
              </div>
              <a
                id="download-excel-btn"
                href={getExcelReportUrl(selectedExamId)}
                download
                className="btn btn-primary btn-full mt-2"
              >
                ⬇️ Download Excel (.xlsx)
              </a>
            </div>

            {/* PDF Report */}
            <div className="card animate-slide-up">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>PDF Report</h3>
              <p className="text-muted text-sm mb-3">
                Printable PDF with ranked results, per-participant topic scores. Ideal for sharing or archiving.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>🏆 Ranked results</div>
                <div className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>📚 Topic breakdown</div>
              </div>
              <a
                id="download-pdf-btn"
                href={getPdfReportUrl(selectedExamId)}
                download
                className="btn btn-secondary btn-full mt-2"
              >
                ⬇️ Download PDF
              </a>
            </div>

            {/* Leaderboard link */}
            <div className="card animate-slide-up">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏆</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Live Leaderboard</h3>
              <p className="text-muted text-sm mb-3">
                Share the public leaderboard URL with participants. Updates in real-time via Supabase Realtime.
              </p>
              <button
                id="open-leaderboard-btn"
                className="btn btn-ghost btn-full mt-2"
                onClick={() => window.open(`/leaderboard/${selectedExamId}`, '_blank')}
              >
                🔗 Open Leaderboard
              </button>
            </div>
          </div>
        )}

        {!selectedExamId && (
          <div className="card text-center" style={{ padding: 48, maxWidth: 500 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📈</div>
            <p className="font-bold mb-1">Select an exam above</p>
            <p className="text-muted text-sm">to access download options.</p>
          </div>
        )}
      </main>
    </div>
    </AnimatedPage>
  );
}
