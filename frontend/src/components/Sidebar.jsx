import React from 'react';

const Sidebar = ({ activeTab, onTabChange, isConnected, isOpen, onClose }) => {
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
            ✨
          </div>
          <div className="brand-info">
            <span className="brand-title">Antigravity AI</span>
            <span className="brand-subtitle">Meeting Intelligence</span>
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

      {/* Footer System Status */}
      <div className="sidebar-footer">
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
