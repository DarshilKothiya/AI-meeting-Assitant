import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import {
  SearchIcon,
  RefreshIcon,
  PlayIcon,
  FolderIcon,
  SparklesIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
  GridIcon,
  ListIcon,
  AlertCircleIcon,
} from './Icons';

const MeetingsList = ({ onSelectMeeting, onStartNewMeeting, onNotify }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, has_summary
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [durationFilter, setDurationFilter] = useState('all'); // all, short, medium, long
  const [viewMode, setViewMode] = useState('grid'); // grid | table
  const [confirmDeleteMeeting, setConfirmDeleteMeeting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAllMeetings();
      setMeetings(data || []);
    } catch (err) {
      console.error('Failed to load meetings list:', err);
      setError(err.message || 'Unable to load meeting history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (sessionId) => {
    try {
      setIsDeleting(true);
      await apiService.deleteMeeting(sessionId);
      setMeetings((prev) => prev.filter((m) => m.session_id !== sessionId));
      setConfirmDeleteMeeting(null);
      onNotify?.({
        type: 'success',
        title: 'Meeting Deleted',
        message: 'The meeting and its transcript were removed.',
      });
    } catch (err) {
      onNotify?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete meeting.',
      });
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
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredMeetings = meetings.filter((m) => {
    const q = search.toLowerCase();
    const nameMatch =
      (m.session_name || m.session_id || '').toLowerCase().includes(q) ||
      (m.concise_summary || '').toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (statusFilter === 'active' && m.status !== 'active') return false;
    if (statusFilter === 'completed' && m.status !== 'completed') return false;
    if (statusFilter === 'has_summary' && !m.has_summary) return false;

    if (dateFilter !== 'all' && m.start_time) {
      const start = new Date(m.start_time).getTime();
      const now = Date.now();
      const diffDays = (now - start) / (1000 * 60 * 60 * 24);
      if (dateFilter === 'today' && diffDays > 1) return false;
      if (dateFilter === 'week' && diffDays > 7) return false;
      if (dateFilter === 'month' && diffDays > 30) return false;
    }

    const dur = m.duration_seconds || 0;
    if (durationFilter === 'short' && dur >= 300) return false;
    if (durationFilter === 'medium' && (dur < 300 || dur > 1800)) return false;
    if (durationFilter === 'long' && dur <= 1800) return false;

    return true;
  });

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('all');
    setDurationFilter('all');
  };

  return (
    <div className="content-container">
      {/* Header */}
      <div className="meetings-controls-row">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Meeting History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Search and filter past recordings, transcripts, and Groq AI summaries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              type="button"
              className="icon-btn"
              style={{
                border: 'none',
                borderRadius: 0,
                background: viewMode === 'grid' ? 'var(--ai-primary-soft)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--ai-primary)' : 'var(--text-muted)',
              }}
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              aria-label="Card grid view"
            >
              <GridIcon size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{
                border: 'none',
                borderRadius: 0,
                background: viewMode === 'table' ? 'var(--ai-primary-soft)' : 'transparent',
                color: viewMode === 'table' ? 'var(--ai-primary)' : 'var(--text-muted)',
              }}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table view"
            >
              <ListIcon size={16} />
            </button>
          </div>

          <button type="button" className="btn btn-secondary" onClick={loadMeetings}>
            <RefreshIcon size={15} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={onStartNewMeeting}>
            <PlayIcon size={14} />
            <span>Start Meeting</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="meetings-controls-row" style={{ marginBottom: '1.5rem' }}>
        <div className="search-input-wrap">
          <span className="search-icon">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Search meetings, topics, summaries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'has_summary', label: 'With Summary' },
            { key: 'active', label: 'Live' },
            { key: 'completed', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn ${statusFilter === f.key ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.42rem 0.85rem', fontSize: '0.8rem' }}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}

          <select
            className="form-input"
            style={{ padding: '0.42rem 0.65rem', fontSize: '0.8rem' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
          >
            <option value="all">Any Date</option>
            <option value="today">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>

          <select
            className="form-input"
            style={{ padding: '0.42rem 0.65rem', fontSize: '0.8rem' }}
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
            aria-label="Filter by duration"
          >
            <option value="all">Any Duration</option>
            <option value="short">Under 5 mins</option>
            <option value="medium">5 – 30 mins</option>
            <option value="long">Over 30 mins</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="auth-error" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </span>
          <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={loadMeetings}>
            Retry
          </button>
        </div>
      )}

      {/* Loading / Empty / Content */}
      {loading ? (
        <div className="meetings-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-box" style={{ height: '175px' }} />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FolderIcon size={24} />
          </div>
          <div className="empty-title">
            {search || statusFilter !== 'all' || dateFilter !== 'all' || durationFilter !== 'all'
              ? 'No Matching Meetings Found'
              : 'No Meetings Recorded Yet'}
          </div>
          <p className="empty-desc">
            {search || statusFilter !== 'all' || dateFilter !== 'all' || durationFilter !== 'all'
              ? 'Try adjusting your search query or filters.'
              : 'Start your first live meeting session to transcribe and generate AI summaries.'}
          </p>
          {search || statusFilter !== 'all' || dateFilter !== 'all' || durationFilter !== 'all' ? (
            <button type="button" className="btn btn-secondary" onClick={resetFilters}>
              Reset Filters
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onStartNewMeeting}>
              <PlayIcon size={14} />
              <span>Start First Meeting</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="meetings-grid">
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.session_id}
              className="meeting-card"
              onClick={() => onSelectMeeting(meeting.session_id)}
            >
              <div className="meeting-card-top">
                <div className="meeting-title">{meeting.session_name || 'Meeting Session'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {meeting.has_summary && (
                    <span className="badge badge-summary">
                      <SparklesIcon size={11} />
                      Summary
                    </span>
                  )}
                  <span className={`badge ${meeting.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                    {meeting.status === 'active' ? 'Live' : 'Done'}
                  </span>
                  <button
                    type="button"
                    className="btn-card-delete"
                    title="Delete Meeting"
                    aria-label="Delete Meeting"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteMeeting(meeting);
                    }}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>

              <div
                className="meeting-preview-text"
                style={!meeting.concise_summary ? { fontStyle: 'italic', color: 'var(--text-muted)' } : undefined}
              >
                {meeting.concise_summary ||
                  (meeting.has_summary
                    ? 'AI summary generated. Click to view key decisions and action items.'
                    : 'Transcript recorded. Click to generate an AI summary with Groq.')}
              </div>

              <div className="meeting-card-footer">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CalendarIcon size={13} />
                  {formatDate(meeting.start_time)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ClockIcon size={13} />
                  {formatDuration(meeting.duration_seconds)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Meeting Title</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map((meeting) => (
                  <tr key={meeting.session_id} onClick={() => onSelectMeeting(meeting.session_id)}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{meeting.session_name || 'Meeting Session'}</div>
                      {meeting.concise_summary && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '380px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {meeting.concise_summary}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(meeting.start_time)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDuration(meeting.duration_seconds)}
                    </td>
                    <td>
                      <span className={`badge ${meeting.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                        {meeting.status === 'active' ? 'Live' : 'Done'}
                      </span>
                    </td>
                    <td>
                      {meeting.has_summary ? (
                        <span className="badge badge-summary">
                          <SparklesIcon size={11} />
                          Ready
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-card-delete"
                        title="Delete Meeting"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteMeeting(meeting);
                        }}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteMeeting && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setConfirmDeleteMeeting(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--ai-rose)' }}>
              <TrashIcon size={20} />
              <h3 className="modal-title">Delete Meeting</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                "{confirmDeleteMeeting.session_name || confirmDeleteMeeting.session_id}"
              </strong>
              ? This will permanently remove all transcript chunks and AI summaries.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteMeeting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
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
