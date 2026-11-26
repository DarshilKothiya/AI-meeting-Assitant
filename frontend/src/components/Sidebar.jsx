import React from 'react';

const Sidebar = ({ activeTab, onTabChange, isConnected, isOpen, onClose, user, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'meetings', label: 'Meetings', icon: '📁' },
    { id: 'live', label: 'Live Meeting', icon: '🎙️' },
    { id: 'summaries', label: 'AI Summaries', icon: '✨' },
    { id: 'action-items', label: 'Action Items', icon: '☑️' },
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
          <div className="brand-icon">
            N
          </div>
          <div className="brand-info">
            <span className="brand-title">Nexora</span>
            <span className="brand-subtitle">Meeting Assistant</span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer System Status & User Account */}
      <div className="sidebar-footer">
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
            >
              Sign Out
            </button>
          </div>
        )}

        <div className="status-pill">
          <div className={`status-dot ${isConnected ? 'connected' : ''}`} />
          <span>{isConnected ? 'Backend Connected' : 'Connecting...'}</span>
        </div>

        <div className="groq-badge">
          <span>Groq AI Ready</span>
          <span>⚡ Ultra-Fast LLM</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
