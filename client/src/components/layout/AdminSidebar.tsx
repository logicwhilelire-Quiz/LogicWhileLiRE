import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo';

interface AdminSidebarProps {
  activeTab?: string;
}

export default function AdminSidebar({ activeTab }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || '{"role":"super_admin","name":"R. Charan Sai"}');
    } catch {
      return { role: 'super_admin', name: 'R. Charan Sai' };
    }
  })();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    { id: 'exams', label: 'Exam Control', path: '/admin/exams', icon: '⚙️' },
    { id: 'questions', label: 'Question Bank', path: '/admin/questions', icon: '❓' },
    { id: 'students', label: 'Student Roster', path: '/admin/students', icon: '👥' },
    { id: 'monitor', label: '100-Tile Monitor Wall', path: '/admin/monitor', icon: '📡' },
    { id: 'results', label: 'Results & Analytics', path: '/admin/results', icon: '📈' },
    { id: 'settings', label: 'Platform & Engine', path: '/admin/settings', icon: '🛡️' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  };

  return (
    <aside className="admin-sidebar" style={{ width: 260, flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ marginBottom: 20 }}>
        <BrandLogo size="sm" />
      </div>

      {/* Admin Identity Badge */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(43, 127, 255, 0.08)',
          border: '1px solid rgba(43, 127, 255, 0.25)',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: '0.68rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ADMINISTRATIVE CONTROL
        </div>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
          {currentUser.name || currentUser.email || 'Admin'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Master Authority</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="admin-sidebar-title" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-faint)', marginBottom: 8 }}>
        Control Center
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id || location.pathname === item.path || (item.id === 'dashboard' && location.pathname === '/admin/dashboard');
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`admin-nav-item ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                background: isActive ? 'rgba(43, 127, 255, 0.18)' : 'transparent',
                border: isActive ? '1px solid rgba(43, 127, 255, 0.4)' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={handleLogout}
          className="admin-nav-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-danger, #EF4444)',
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          <span>🚪</span>
          <span>Logout Portal</span>
        </button>
      </div>
    </aside>
  );
}
