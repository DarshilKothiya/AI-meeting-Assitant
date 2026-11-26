import React from 'react';
import {
  LayoutDashboardIcon,
  FolderIcon,
  MicIcon,
  SparklesIcon,
  CheckSquareIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  ZapIcon,
} from './Icons';

const Sidebar = ({
  activeTab,
  onTabChange,
  isConnected,
  isOpen,
  onClose,
  user,
  onLogout,
  theme,
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboardIcon },
    { id: 'meetings', label: 'Meeting History', Icon: FolderIcon },
    { id: 'live', label: 'Live Meeting', Icon: MicIcon },
    { id: 'summaries', label: 'AI Summaries', Icon: SparklesIcon },
    { id: 'action-items', label: 'Action Items', Icon: CheckSquareIcon },
  ];

  const handleItemClick = (id) => {
    onTabChange(id);
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="brand-icon">N</div>
          <div className="brand-info">
            <span className="brand-title">Nexora</span>
            <span className="brand-subtitle">Meeting Assistant</span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => handleItemClick(id)}
          >
            <span className="nav-icon">
              <Icon size={18} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Footer: Theme, User Account, Status */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {theme === 'light' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          </span>
          <div className={`theme-toggle-pill ${theme === 'light' ? 'light' : ''}`}>
            <div className="theme-toggle-knob" />
          </div>
        </button>

        {user && (
          <div className="user-account-card">
            <div className="user-account-info">
              <div className="user-avatar">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name">{user.name || 'User'}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn-logout"
              onClick={onLogout}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOutIcon size={15} />
            </button>
          </div>
        )}

        <div className="status-pill" title="Backend WebSocket Connection">
          <div className={`status-dot ${isConnected ? 'connected' : ''}`} />
          <span>{isConnected ? 'Live Sync Connected' : 'Connecting...'}</span>
        </div>

        <div
          className="status-pill"
          style={{
            justifyContent: 'space-between',
            color: 'var(--ai-primary)',
            background: 'var(--ai-primary-soft)',
            borderColor: 'rgba(25, 118, 210, 0.25)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ZapIcon size={14} />
            Groq AI Ready
          </span>
          <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>LLM</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
