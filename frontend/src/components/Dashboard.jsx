import React from 'react';
import TranscriptPanel from './TranscriptPanel';

const Dashboard = ({ 
  state, 
  onStartSession, 
  onStopSession, 
  onViewMeetingSummary,
  showStartDialog, 
  setShowStartDialog, 
  sessionName, 
  setSessionName 
}) => {
  const isRecording = state.sessionStatus === 'recording';

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="content-container">
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap icon-blue">
            <span></span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Session Status</div>
            <div className="metric-value" style={{ fontSize: '1.2rem', textTransform: 'capitalize' }}>
              {isRecording ? (
                <span style={{ color: 'var(--ai-rose)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ai-rose)', animation: 'record-pulse 1.5s infinite' }} />
                  Recording
                </span>
              ) : state.sessionStatus === 'completed' ? (
                <span style={{ color: 'var(--ai-emerald)' }}>Completed</span>
              ) : (
                'Idle'
              )}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-purple">
            <span>⏱️</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Duration</div>
            <div className="metric-value">
              {formatDuration(state.sessionStats?.totalDuration)}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-green">
            <span>🧩</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Chunks Transcribed</div>
            <div className="metric-value">
              {state.sessionStats?.totalChunks || 0}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-amber">
            <span>👥</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Speakers Detected</div>
            <div className="metric-value">
              {state.speakers?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Completed Session Banner if finished */}
      {state.sessionStatus === 'completed' && state.currentSession && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✨</span> Session Completed Successfully!
            </div>
            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Your meeting transcript is saved. Generate your LLM structured meeting summary now with Groq.
            </p>
          </div>

          <button 
            className="btn btn-ai-sparkle" 
            onClick={() => onViewMeetingSummary(state.currentSession)}
            style={{ padding: '0.65rem 1.25rem' }}
          >
            ✨ View & Generate AI Summary
          </button>
        </div>
      )}

      {/* Main Split Content: Left Transcript, Right AI Insights */}
      <div className="live-panes-grid">
        {/* Left Column: Live Transcript Panel */}
        <TranscriptPanel 
          chunks={state.chunks}
          error={state.error}
          isLive={isRecording}
        />

        {/* Right Column: Real-time Analytics & Entities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Action Card: Quick Start or Stop */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>⚡</span> Live Controls
              </div>
            </div>
            <div className="card-body">
              {isRecording ? (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Microphone is capturing in 15-second audio chunks and transcribing using Faster-Whisper.
                  </p>
                  <button 
                    className="btn btn-record" 
                    onClick={onStopSession}
                    style={{ width: '100%' }}
                  >
                    ⏹ Stop Session & View Summary
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Begin recording or transcribing a meeting from your microphone or audio input device.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setShowStartDialog(true)}
                    style={{ width: '100%' }}
                  >
                    Start New Meeting
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Speakers Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>👥</span> Speakers ({state.speakers?.length || 0})
              </div>
            </div>
            <div className="card-body">
              {state.speakers && state.speakers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {state.speakers.map((sp, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>👤 {sp.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{sp.count} turns</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No speakers detected yet</p>
              )}
            </div>
          </div>

          {/* Emotion Distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>🧠</span> Emotion Analysis
              </div>
            </div>
            <div className="card-body">
              {state.emotions && state.emotions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {state.emotions.map((em, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-light)', textTransform: 'capitalize' }}>{em.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{em.percentage}%</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${em.percentage}%`, 
                            backgroundColor: 'var(--ai-primary)',
                            borderRadius: 'var(--radius-pill)' 
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No emotion patterns detected yet</p>
              )}
            </div>
          </div>

          {/* Technical Jargon Terms */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>💡</span> Technical Terms ({state.technicalTerms?.length || 0})
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {state.technicalTerms && state.technicalTerms.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {state.technicalTerms.slice(0, 10).map((term, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '0.5rem', 
                        backgroundColor: 'rgba(15, 23, 42, 0.4)', 
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#A5B4FC' }}>
                        #{term.term}
                      </div>
                      {term.definition && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {term.definition}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No technical terms detected yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Start Session Modal Dialog */}
      {showStartDialog && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="modal-title">Start New Meeting Session</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Give your meeting a descriptive title. Faster-Whisper will transcribe the conversation in real-time.
            </p>

            <input
              type="text"
              className="form-input"
              placeholder="e.g., Weekly Product Sync & Roadmap Review"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onStartSession();
                }
              }}
            />

            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowStartDialog(false);
                  setSessionName('');
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onStartSession}>
                 Begin Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
