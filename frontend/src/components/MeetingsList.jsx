import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const MeetingsList = ({ onSelectMeeting, onStartNewMeeting }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, has_summary
  const [confirmDeleteMeeting, setConfirmDeleteMeeting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAllMeetings();
      setMeetings(data || []);
    } catch (err) {
      console.error('Failed to load meetings list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (sessionId) => {
    try {
      setIsDeleting(true);
      await apiService.deleteMeeting(sessionId);
      setMeetings(prev => prev.filter(m => m.session_id !== sessionId));
      setConfirmDeleteMeeting(null);
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Error deleting meeting: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredMeetings = meetings.filter(m => {
    const nameMatch = (m.session_name || m.session_id || '').toLowerCase().includes(search.toLowerCase()) ||
                      (m.concise_summary || '').toLowerCase().includes(search.toLowerCase());

    if (!nameMatch) return false;
    if (statusFilter === 'active') return m.status === 'active';
    if (statusFilter === 'completed') return m.status === 'completed';
    if (statusFilter === 'has_summary') return m.has_summary === true;
    return true;
  });

  return (
    <div className="content-container">
      {/* Top Controls Header */}
      <div className="meetings-controls-row">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>
            Meeting Sessions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Browse past recordings, live transcripts, and Groq-generated AI summaries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={loadMeetings}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary" onClick={onStartNewMeeting}>
             Start Meeting
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="meetings-controls-row" style={{ marginBottom: '2rem' }}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search meetings, topics, summaries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Meetings' },
            { key: 'has_summary', label: '✨ With AI Summary' },
            { key: 'active', label: '● Live Now' },
            { key: 'completed', label: 'Completed' },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-outline ${statusFilter === f.key ? 'btn-primary' : ''}`}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', minHeight: '34px' }}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="meetings-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card skeleton-box" style={{ height: '180px' }} />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-title">
            {search ? 'No Matching Meetings Found' : 'No Meetings Recorded Yet'}
          </div>
          <p className="empty-desc">
            {search 
              ? `No meetings matching "${search}". Try clearing your search query.`
              : 'Start your first live meeting or recording session to transcribe and generate AI summaries.'}
          </p>
          {search ? (
            <button className="btn btn-secondary" onClick={() => setSearch('')}>
              Clear Search
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onStartNewMeeting}>
               Start Your First Meeting
            </button>
          )}
        </div>
      ) : (
        <div className="meetings-grid">
          {filteredMeetings.map(meeting => (
            <div 
              key={meeting.session_id} 
              className="meeting-card"
              onClick={() => onSelectMeeting(meeting.session_id)}
            >
              <div className="meeting-card-top">
                <div className="meeting-title">
                  {meeting.session_name || 'Meeting Session'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {meeting.has_summary && (
                    <span className="badge badge-summary">
                      ✨ Summary
                    </span>
                  )}
                  <span className={`badge ${meeting.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                    {meeting.status === 'active' ? 'Live' : 'Done'}
                  </span>
                  <button
                    className="btn-card-delete"
                    title="Delete Meeting"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteMeeting(meeting);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {meeting.concise_summary ? (
                <div className="meeting-preview-text">
                  "{meeting.concise_summary}"
                </div>
              ) : (
                <div className="meeting-preview-text" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  {meeting.has_summary 
                    ? 'AI summary generated. Click to view key decisions and action items.' 
                    : 'Transcript recorded. Click to generate AI summary with Groq.'}
                </div>
              )}

              <div className="meeting-card-footer">
                <span>📅 {formatDate(meeting.start_time)}</span>
                <span>⏱️ {formatDuration(meeting.duration_seconds)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteMeeting && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setConfirmDeleteMeeting(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🗑️</span>
              <h3 className="modal-title">Delete Meeting</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0.25rem 0' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>"{confirmDeleteMeeting.session_name || confirmDeleteMeeting.session_id}"</strong>?
            </p>
            <p style={{ color: '#FCA5A5', fontSize: '0.8rem', margin: 0, padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              ⚠️ This will permanently remove all transcript chunks, dialogue, and AI summaries for this session.
            </p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                disabled={isDeleting}
                onClick={() => setConfirmDeleteMeeting(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                disabled={isDeleting}
                onClick={() => handleDeleteMeeting(confirmDeleteMeeting.session_id)}
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingsList;
