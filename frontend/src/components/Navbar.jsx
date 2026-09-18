import React from 'react';

const Navbar = ({ 
  sessionStatus, 
  onStartSession, 
  onStopSession, 
  onToggleSidebar, 
  audioDevices, 
  selectedDevice, 
  onSelectDevice,
  activeSessionName 
}) => {
  const isRecording = sessionStatus === 'recording';

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button 
          className="mobile-nav-toggle" 
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className="page-heading">
          {isRecording ? (
            <>
              <span style={{ color: 'var(--ai-rose)', animation: 'record-pulse 1.5s infinite' }}>●</span>
              <span>Recording: {activeSessionName || 'Live Session'}</span>
            </>
          ) : (
            <span>Meeting Intelligence Platform</span>
          )}
        </div>
      </div>

      <div className="navbar-right">
        {/* Device selector if available */}
        {audioDevices && audioDevices.length > 0 && !isRecording && (
          <select 
            className="form-input" 
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', width: 'auto', minWidth: '150px' }}
            value={selectedDevice}
            onChange={(e) => onSelectDevice && onSelectDevice(e.target.value)}
          >
            {audioDevices.map(dev => (
              <option key={dev.device_id} value={dev.device_id}>
                🎤 {dev.name}
              </option>
            ))}
          </select>
        )}

        {/* Start / Stop Session Button */}
        {isRecording ? (
          <button className="btn btn-record" onClick={onStopSession}>
            <span style={{ fontSize: '0.8rem' }}>⏹</span>
            Stop & Finish Session
          </button>
        ) : (
          <button className="btn btn-record-start" onClick={onStartSession}>
            <span>🎙️</span>
            Start Live Meeting
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
