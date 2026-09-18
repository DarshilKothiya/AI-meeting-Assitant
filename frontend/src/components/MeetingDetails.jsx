import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const MeetingDetails = ({ meetingId, onBack }) => {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(1);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [error, setError] = useState(null);
  const [transcriptFilter, setTranscriptFilter] = useState('');
  const [completedTasks, setCompletedTasks] = useState({});

  const loadMeeting = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getMeetingDetails(meetingId);
      setMeeting(data);
    } catch (err) {
      setError(err.message || 'Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
    }
  }, [meetingId, loadMeeting]);

  const handleGenerateSummary = async (forceRegenerate = false) => {
    try {
      setIsGenerating(true);
      setError(null);
      setGeneratingStep(1);

      // Progressive status updates
      const stepTimer1 = setTimeout(() => setGeneratingStep(2), 1200);
      const stepTimer2 = setTimeout(() => setGeneratingStep(3), 2800);

      const response = await apiService.generateMeetingSummary(meetingId, forceRegenerate);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      // Update local meeting state with new summary
      setMeeting(prev => ({
        ...prev,
        summary: response.summary,
        summary_metadata: {
          generated_at: response.generated_at,
          model_used: response.model_used,
          summary_version: response.summary_version,
          is_cached: response.is_cached,
        },
      }));
      setShowRegenModal(false);
    } catch (err) {
      setError(err.message || 'Unable to generate summary. Please ensure GROQ_API_KEY is configured and try again.');
    } finally {
      setIsGenerating(false);
      setGeneratingStep(1);
    }
  };

  const toggleTask = (taskIndex) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskIndex]: !prev[taskIndex],
    }));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading meeting details...</p>
        </div>
      </div>
    );
  }

  if (!meeting && error) {
    return (
      <div className="content-container">
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1.5rem' }}>
          ← Back to Meetings
        </button>
        <div className="empty-state">
          <div className="empty-icon" style={{ color: 'var(--ai-rose)' }}>⚠️</div>
          <div className="empty-title">Failed to Load Meeting</div>
          <p className="empty-desc">{error}</p>
          <button className="btn btn-primary" onClick={loadMeeting}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = meeting?.summary;
  const metadata = meeting?.summary_metadata;
  const transcriptLines = (meeting?.combined_transcript || '').split('\n').filter(l => l.trim().length > 0);
  const filteredTranscript = transcriptLines.filter(l => l.toLowerCase().includes(transcriptFilter.toLowerCase()));

  return (
    <div className="content-container">
      {/* Back Navigation & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Meetings
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${meeting?.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
            {meeting?.status === 'active' ? '● Live Recording' : 'Completed'}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Duration: {formatDuration(meeting?.duration_seconds)}
          </span>
        </div>
      </div>

      {/* Meeting Title Banner */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          {meeting?.session_name || 'Meeting Intelligence Brief'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {formatDate(meeting?.start_time)} • Session ID: <code style={{ color: '#A5B4FC' }}>{meeting?.session_id}</code>
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FCA5A5',
          fontSize: '0.9rem'
        }}>
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button className="btn btn-outline" onClick={() => handleGenerateSummary(false)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* ====================================================================
          AI Summary Hero Section
          ==================================================================== */}
      <div className="summary-hero-card">
        <div className="summary-header-row">
          <div className="summary-title-wrap">
            <span style={{ fontSize: '1.4rem' }}>✨</span>
            <div className="summary-title">AI Meeting Intelligence</div>
            {summary && metadata?.model_used && (
              <div className="model-badge">
                <span>Groq</span> • {metadata.model_used}
              </div>
            )}
          </div>

          <div>
            {summary ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowRegenModal(true)}
                disabled={isGenerating}
              >
                🔄 Regenerate Summary
              </button>
            ) : (
              <button 
                className="btn btn-ai-sparkle" 
                onClick={() => handleGenerateSummary(false)}
                disabled={isGenerating}
              >
                ✨ Generate AI Summary
              </button>
            )}
          </div>
        </div>

        {/* Loading State during Generation */}
        {isGenerating && (
          <div className="loading-container" style={{ padding: '2.5rem 1rem' }}>
            <div className="spinner" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
                {generatingStep === 1 && 'Extracting transcript and sending to Groq LLM...'}
                {generatingStep === 2 && 'Structuring key points, decisions, and action items...'}
                {generatingStep === 3 && 'Finalizing AI Meeting Intelligence Brief...'}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Powered by LangChain & Groq High-Speed Inference
              </p>
            </div>
          </div>
        )}

        {/* Empty State: Summary not yet generated */}
        {!isGenerating && !summary && (
          <div className="empty-state" style={{ background: 'transparent', border: 'none', padding: '2rem 1rem' }}>
            <div className="empty-icon" style={{ width: '60px', height: '60px', fontSize: '1.8rem' }}>✨</div>
            <div className="empty-title" style={{ fontSize: '1.25rem' }}>No AI Summary Generated Yet</div>
            <p className="empty-desc" style={{ maxWidth: '440px' }}>
              Generate an executive summary, key discussion points, decisions made, and assigned action items using Groq's fast LLM engine.
            </p>
            <button 
              className="btn btn-ai-sparkle" 
              onClick={() => handleGenerateSummary(false)}
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
            >
              ✨ Generate AI Summary with Groq
            </button>
          </div>
        )}

        {/* Generated Summary View */}
        {!isGenerating && summary && (
          <div>
            {/* Quick Concise Summary Banner */}
            {summary.concise_summary && (
              <div className="concise-takeaway-banner">
                <div className="concise-takeaway-label">
                  ⚡ Executive Takeaway
                </div>
                <div className="concise-takeaway-text">
                  "{summary.concise_summary}"
                </div>
              </div>
            )}

            {/* Overview & Executive Summary Cards */}
            <div className="summary-sections-grid">
              <div className="summary-box">
                <div className="summary-box-title">
                  <span>📌</span> Meeting Overview
                </div>
                <div className="summary-box-content">
                  {summary.meeting_overview || 'Not mentioned'}
                </div>
              </div>

              <div className="summary-box">
                <div className="summary-box-title">
                  <span>📋</span> Executive Summary
                </div>
                <div className="summary-box-content">
                  {summary.executive_summary || 'Not mentioned'}
                </div>
              </div>
            </div>

            {/* Key Discussion Points & Decisions */}
            <div className="summary-sections-grid">
              {/* Discussion Points */}
              <div className="summary-box">
                <div className="summary-box-title">
                  <span>💡</span> Key Discussion Points
                </div>
                {summary.key_points && summary.key_points.length > 0 ? (
                  <ul className="points-list">
                    {summary.key_points.map((pt, i) => (
                      <li key={i} className="point-item">
                        <div className="point-dot" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not mentioned</p>
                )}
              </div>

              {/* Decisions Made */}
              <div className="summary-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div className="summary-box-title" style={{ color: '#6EE7B7' }}>
                  <span>✅</span> Decisions Made
                </div>
                {summary.decisions_made && summary.decisions_made.length > 0 ? (
                  <ul className="points-list">
                    {summary.decisions_made.map((dec, i) => (
                      <li key={i} className="point-item">
                        <span className="point-decision-icon">✔</span>
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No explicit decisions recorded</p>
                )}
              </div>
            </div>

            {/* Action Items Board */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>☑️</span> Action Items & Deliverables
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    ({summary.action_items?.length || 0})
                  </span>
                </h3>
              </div>

              {summary.action_items && summary.action_items.length > 0 ? (
                <div className="action-items-container">
                  {summary.action_items.map((item, idx) => {
                    const isDone = completedTasks[idx];
                    return (
                      <div key={idx} className={`action-card ${isDone ? 'completed' : ''}`}>
                        <div className="action-left">
                          <input 
                            type="checkbox" 
                            className="action-checkbox" 
                            checked={!!isDone}
                            onChange={() => toggleTask(idx)}
                          />
                          <div className="action-task-title">
                            {item.task}
                          </div>
                        </div>

                        <div className="action-tags">
                          {item.assignee && item.assignee !== 'Not mentioned' && (
                            <span className="tag-badge tag-assignee">
                              👤 {item.assignee}
                            </span>
                          )}
                          {item.deadline && item.deadline !== 'Not mentioned' && (
                            <span className="tag-badge tag-deadline">
                              📅 {item.deadline}
                            </span>
                          )}
                          {item.status && item.status !== 'Not mentioned' && (
                            <span className="tag-badge tag-status">
                              ● {item.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No action items identified in this transcript</p>
                </div>
              )}
            </div>

            {/* Questions, Issues & Follow-ups */}
            <div className="summary-sections-grid">
              {/* Questions & Issues */}
              <div className="summary-box" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <div className="summary-box-title" style={{ color: '#FCD34D' }}>
                  <span>⚠️</span> Open Questions & Blockers
                </div>
                {summary.questions_and_issues && summary.questions_and_issues.length > 0 ? (
                  <ul className="points-list">
                    {summary.questions_and_issues.map((q, i) => (
                      <li key={i} className="point-item">
                        <span className="point-issue-icon">❓</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No open questions or blockers recorded</p>
                )}
              </div>

              {/* Follow-up Items & Participants */}
              <div className="summary-box">
                <div className="summary-box-title">
                  <span>👥</span> Participants & Follow-ups
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Identified Participants:
                  </div>
                  <div className="topics-pills-row">
                    {summary.participants && summary.participants.length > 0 ? (
                      summary.participants.map((p, i) => (
                        <span key={i} className="topic-pill">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not mentioned</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Follow-up Items:
                  </div>
                  {summary.follow_up_items && summary.follow_up_items.length > 0 ? (
                    <ul className="points-list">
                      {summary.follow_up_items.map((fu, i) => (
                        <li key={i} className="point-item">
                          <div className="point-dot" style={{ backgroundColor: 'var(--ai-cyan)' }} />
                          <span>{fu}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No follow-up items scheduled</p>
                  )}
                </div>
              </div>
            </div>

            {/* Key Topics & Tags */}
            {summary.key_topics && summary.key_topics.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Key Topics & Technologies:
                </div>
                <div className="topics-pills-row">
                  {summary.key_topics.map((t, i) => (
                    <span key={i} className="topic-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#A5B4FC' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
          Full Transcript Section
          ==================================================================== */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>🎙️</span> Complete Transcript
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ({transcriptLines.length} segments)
            </span>
          </div>

          <div style={{ width: '260px' }}>
            <input
              type="text"
              className="form-input"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              placeholder="Search in transcript..."
              value={transcriptFilter}
              onChange={(e) => setTranscriptFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="card-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {transcriptLines.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No transcribed speech available for this meeting.</p>
            </div>
          ) : filteredTranscript.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No matching lines found for "{transcriptFilter}".</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTranscript.map((line, idx) => (
                <div 
                  key={idx} 
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    color: 'var(--text-light)',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Summary Regeneration */}
      {showRegenModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="modal-title">Regenerate AI Summary?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              This will send the full meeting transcript to Groq LLM again to re-extract insights, decisions, and action items.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRegenModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-ai-sparkle" 
                onClick={() => handleGenerateSummary(true)}
              >
                Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingDetails;
