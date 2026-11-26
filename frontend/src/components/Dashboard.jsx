import React, { useEffect, useState } from 'react';
import TranscriptPanel from './TranscriptPanel';
import StatCard from './StatCard';
import { apiService } from '../services/apiService';
import {
  PlayIcon,
  StopIcon,
  ClockIcon,
  FolderIcon,
  CheckSquareIcon,
  ActivityIcon,
  SparklesIcon,
  TagIcon,
  ZapIcon,
  CalendarIcon,
  FileTextIcon,
} from './Icons';

const Dashboard = ({
  mode = 'dashboard',
  user,
  state,
  onStartSession,
  onStopSession,
  onViewMeetingSummary,
  onSelectMeeting,
  onNavigateTab,
  showStartDialog,
  setShowStartDialog,
  sessionName,
  setSessionName,
}) => {
  const isRecording = state.sessionStatus === 'recording';
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [actionItemsCount, setActionItemsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Synchronized live recording elapsed timer
  useEffect(() => {
    if (!isRecording) {
      setElapsedSeconds(Math.floor(state.sessionStats?.totalDuration || 0));
      return;
    }
    const startTime = state.sessionStartedAt || Date.now();
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRecording, state.sessionStartedAt, state.sessionStats?.totalDuration]);

  // Load real dashboard metrics & recent meetings
  useEffect(() => {
    if (mode !== 'dashboard') return;
    let active = true;

    const loadOverview = async () => {
      try {
        setLoadingStats(true);
        const [meetingsData, actionsData] = await Promise.all([
          apiService.getAllMeetings(50).catch(() => []),
          apiService.getAllActionItems(50).catch(() => []),
        ]);
        if (!active) return;
        setRecentMeetings(Array.isArray(meetingsData) ? meetingsData : []);
        setActionItemsCount(Array.isArray(actionsData) ? actionsData.length : 0);
      } finally {
        if (active) setLoadingStats(false);
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, [mode, state.sessionStatus]);

  const formatTimer = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = Math.floor(totalSecs % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDurationShort = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Aggregate real stats
  const totalMeetings = recentMeetings.length;
  const totalSecondsAll = recentMeetings.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
  const totalHoursText =
    totalSecondsAll >= 3600
      ? `${(totalSecondsAll / 3600).toFixed(1)} hrs`
      : `${Math.round(totalSecondsAll / 60)} mins`;
  const avgDurationSecs = totalMeetings > 0 ? totalSecondsAll / totalMeetings : 0;

  // Named entities and micro-summaries from live chunks
  const namedEntities = [];
  const entitySeen = new Set();
  const microSummaries = [];
  (state.chunks || []).forEach((c) => {
    if (Array.isArray(c.jargon)) {
      c.jargon.forEach((j) => {
        if (j.entity_type && j.term && !entitySeen.has(j.term.toLowerCase())) {
          entitySeen.add(j.term.toLowerCase());
          namedEntities.push({ term: j.term, type: j.entity_type });
        }
      });
    }
    if (c.micro_summary && c.micro_summary.trim()) {
      microSummaries.push({ id: c.chunk_id, text: c.micro_summary });
    }
  });

  // Render Live Meeting Workspace when on 'live' tab or actively recording
  const showLiveWorkspace = mode === 'live' || isRecording;

  return (
    <div className="content-container">
      {!showLiveWorkspace ? (
        <>
          {/* Welcome Hero Banner */}
          <div className="hero-banner">
            <div>
              <h1 className="hero-title">
                Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <p className="hero-subtitle">
                Capture live meetings, track real-time emotions & key jargon, and generate structured Groq AI briefs in seconds.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigateTab && onNavigateTab('meetings')}
              >
                <FolderIcon size={16} />
                <span>View History</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowStartDialog(true)}
              >
                <PlayIcon size={15} />
                <span>Start Meeting</span>
              </button>
            </div>
          </div>

          {/* 4 Quick Statistics */}
          <div className="metrics-grid">
            <StatCard
              icon={<FolderIcon size={20} />}
              tone="blue"
              label="Total Meetings"
              value={loadingStats ? '—' : totalMeetings}
              subtitle="Stored in your account"
            />
            <StatCard
              icon={<ClockIcon size={20} />}
              tone="purple"
              label="Total Meeting Time"
              value={loadingStats ? '—' : totalHoursText}
              subtitle="Cumulative recorded audio"
            />
            <StatCard
              icon={<ActivityIcon size={20} />}
              tone="green"
              label="Avg. Duration"
              value={loadingStats ? '—' : formatDurationShort(avgDurationSecs)}
              subtitle="Per recorded session"
            />
            <StatCard
              icon={<CheckSquareIcon size={20} />}
              tone="amber"
              label="Action Items"
              value={loadingStats ? '—' : actionItemsCount}
              subtitle="Extracted by Groq AI"
            />
          </div>

          {/* Recent Meetings + Recent Activity */}
          <div className="dashboard-split-grid">
            {/* Recent Meetings */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <FolderIcon size={17} />
                  <span>Recent Meetings</span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                  onClick={() => onNavigateTab && onNavigateTab('meetings')}
                >
                  See All
                </button>
              </div>
              <div className="card-body">
                {loadingStats ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton-box" style={{ height: '76px' }} />
                    ))}
                  </div>
                ) : recentMeetings.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none' }}>
                    <div className="empty-icon">
                      <FolderIcon size={22} />
                    </div>
                    <div className="empty-title">No Meetings Yet</div>
                    <p className="empty-desc">
                      Click "Start Meeting" to record your first session with real-time transcription.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentMeetings.slice(0, 4).map((m) => (
                      <div
                        key={m.session_id}
                        className="meeting-card"
                        style={{ padding: '1rem' }}
                        onClick={() => onSelectMeeting && onSelectMeeting(m.session_id)}
                      >
                        <div className="meeting-card-top">
                          <div className="meeting-title" style={{ fontSize: '0.94rem' }}>
                            {m.session_name || 'Meeting Session'}
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {m.has_summary && (
                              <span className="badge badge-summary">
                                <SparklesIcon size={11} />
                                Summary
                              </span>
                            )}
                            <span className={`badge ${m.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                              {m.status === 'active' ? 'Live' : 'Done'}
                            </span>
                          </div>
                        </div>

                        {m.concise_summary && (
                          <div className="meeting-preview-text">{m.concise_summary}</div>
                        )}

                        <div className="meeting-card-footer" style={{ paddingTop: '0.5rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CalendarIcon size={12} />
                            {formatDate(m.start_time)}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ClockIcon size={12} />
                            {formatDurationShort(m.duration_seconds)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <ActivityIcon size={17} />
                  <span>Recent Activity</span>
                </div>
              </div>
              <div className="card-body">
                {recentMeetings.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                    Activity from your meetings and AI summaries will appear here.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {recentMeetings.slice(0, 5).map((m) => (
                      <div
                        key={m.session_id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          paddingBottom: '0.75rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                        }}
                        onClick={() => onSelectMeeting && onSelectMeeting(m.session_id)}
                      >
                        <div
                          className={`metric-icon-wrap ${m.has_summary ? 'icon-blue' : 'icon-green'}`}
                          style={{ width: '34px', height: '34px' }}
                        >
                          {m.has_summary ? <SparklesIcon size={15} /> : <FileTextIcon size={15} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {m.has_summary ? 'AI Summary Ready' : 'Transcript Recorded'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.session_name || 'Meeting Session'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {formatDate(m.start_time)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Live Meeting Workspace Toolbar */}
          <div className="live-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <span className={`badge ${isRecording ? 'badge-active' : 'badge-completed'}`}>
                {isRecording ? 'Recording Live' : state.sessionStatus === 'completed' ? 'Completed' : 'Ready'}
              </span>
              <div className="live-timer-pill" title="Elapsed Session Duration">
                <ClockIcon size={14} />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {state.sessionStats?.totalChunks || 0} chunks processed
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="status-pill" style={{ margin: 0 }}>
                <div className={`status-dot ${state.isConnected ? 'connected' : ''}`} />
                <span>{state.isConnected ? 'WS Connected' : 'Reconnecting...'}</span>
              </div>

              {isRecording ? (
                <button type="button" className="btn btn-record" onClick={onStopSession}>
                  <StopIcon size={14} />
                  <span>Stop & Finish</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowStartDialog(true)}
                >
                  <PlayIcon size={14} />
                  <span>Start Meeting</span>
                </button>
              )}
            </div>
          </div>

          {/* Completed Session Banner */}
          {state.sessionStatus === 'completed' && state.currentSession && (
            <div className="hero-banner" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Session Completed Successfully
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '0.15rem' }}>
                  Your transcript is saved. Generate your structured Groq AI brief now.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ai-sparkle"
                onClick={() => onViewMeetingSummary(state.currentSession)}
              >
                <SparklesIcon size={15} />
                <span>View & Generate Summary</span>
              </button>
            </div>
          )}

          {/* Split Live Panes */}
          <div className="live-panes-grid">
            <TranscriptPanel chunks={state.chunks} error={state.error} isLive={isRecording} />

            {/* Right Panel: Meeting Intelligence & Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Emotion Analysis */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <ActivityIcon size={16} />
                    <span>Emotion Detection</span>
                  </div>
                </div>
                <div className="card-body">
                  {state.emotions && state.emotions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {state.emotions.map((em, idx) => (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-main)', textTransform: 'capitalize', fontWeight: 600 }}>{em.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{em.percentage}%</span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${em.percentage}%`,
                                backgroundColor: 'var(--ai-primary)',
                                borderRadius: 'var(--radius-pill)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No emotion patterns detected yet
                    </p>
                  )}
                </div>
              </div>

              {/* Keywords & Technical Jargon */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <TagIcon size={16} />
                    <span>Keywords & Jargon ({state.technicalTerms?.length || 0})</span>
                  </div>
                </div>
                <div className="card-body" style={{ maxHeight: '230px', overflowY: 'auto' }}>
                  {state.technicalTerms && state.technicalTerms.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {state.technicalTerms.slice(0, 10).map((term, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.55rem 0.7rem',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ fontWeight: 700, color: 'var(--ai-primary)' }}>
                            {term.term}
                          </div>
                          {term.definition && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: '0.2rem' }}>
                              {term.definition}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No keywords or technical jargon extracted yet
                    </p>
                  )}
                </div>
              </div>

              {/* Named Entities & Micro Summaries */}
              {(namedEntities.length > 0 || microSummaries.length > 0) && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <ZapIcon size={16} />
                      <span>Entities & Micro-Summaries</span>
                    </div>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {namedEntities.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          Named Entities
                        </div>
                        <div className="topics-pills-row">
                          {namedEntities.map((ent, i) => (
                            <span key={i} className="topic-pill">
                              {ent.term} <small style={{ opacity: 0.75 }}>({ent.type})</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {microSummaries.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          Chunk Micro-Summaries
                        </div>
                        <ul className="points-list">
                          {microSummaries.slice(-3).map((ms, i) => (
                            <li key={i} className="point-item">
                              <div className="point-dot" />
                              <span>{ms.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Start Session Modal */}
      {showStartDialog && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="modal-title">Start New Meeting Session</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Give your meeting a descriptive title. Faster-Whisper will transcribe audio in real time.
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
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowStartDialog(false);
                  setSessionName('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onStartSession}>
                <PlayIcon size={14} />
                <span>Begin Recording</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
