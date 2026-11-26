import React from 'react';
import {
  MenuIcon,
  MicIcon,
  PlayIcon,
  StopIcon,
  SunIcon,
  MoonIcon,
} from './Icons';

const Navbar = ({
  sessionStatus,
  onStartSession,
  onStopSession,
  onToggleSidebar,
  audioDevices,
  selectedDevice,
  onSelectDevice,
  activeSessionName,
  theme,
  onToggleTheme,
}) => {
  const isRecording = sessionStatus === 'recording';

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <MenuIcon size={18} />
        </button>

        <div className="page-heading">
          {isRecording ? (
            <>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--ai-rose)',
                  animation: 'record-pulse 1.5s infinite',
                  flexShrink: 0,
                }}
              />
              <span>Recording: {activeSessionName || 'Live Session'}</span>
            </>
          ) : (
            <span>Nexora — Meeting Assistant</span>
          )}
        </div>
      </div>

      <div className="navbar-right">
        {audioDevices && audioDevices.length > 0 && !isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex' }} title="Audio Input Device">
              <MicIcon size={15} />
            </span>
            <select
              className="form-input"
              aria-label="Select audio input device"
              style={{ padding: '0.42rem 0.65rem', fontSize: '0.8rem', minWidth: '150px', maxWidth: '220px' }}
              value={selectedDevice}
              onChange={(e) => onSelectDevice && onSelectDevice(e.target.value)}
            >
              {audioDevices.map((dev) => (
                <option key={dev.device_id} value={dev.device_id}>
                  {dev.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle color theme"
        >
          {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        </button>

        {isRecording ? (
          <button type="button" className="btn btn-record" onClick={onStopSession}>
            <StopIcon size={14} />
            <span>Stop Session</span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStartSession}>
            <PlayIcon size={14} />
            <span>Start Meeting</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
