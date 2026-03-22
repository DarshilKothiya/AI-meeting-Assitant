import React from 'react';

const Navbar = ({ isConnected, onStartSession, onStopSession, sessionStatus }) => {
  return (
    <nav className="navbar">
      <div className="navbar-title">
        Meeting Transcription Dashboard
      </div>
      
      <div className="navbar-actions">
        <div className={`status-badge ${isConnected ? 'connected' : ''}`}>
          <div className="status-dot"></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        
        <button 
          className={`start-session-btn ${sessionStatus === 'recording' ? 'active' : ''}`}
          onClick={sessionStatus === 'recording' ? onStopSession : onStartSession}
        >
          {sessionStatus === 'recording' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Stop Session
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Start Session
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
