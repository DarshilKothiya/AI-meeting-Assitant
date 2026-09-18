import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const ActionItemsView = ({ onSelectMeeting }) => {
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [completedMap, setCompletedMap] = useState({});

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAllActionItems();
      setActionItems(data || []);
    } catch (err) {
      console.error('Failed to load action items:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (index) => {
    setCompletedMap(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const filteredItems = actionItems.filter(item => {
    const term = search.toLowerCase();
    return (
      (item.task || '').toLowerCase().includes(term) ||
      (item.assignee || '').toLowerCase().includes(term) ||
      (item.session_name || '').toLowerCase().includes(term)
    );
  });

  const totalCount = actionItems.length;
  const completedCount = Object.values(completedMap).filter(Boolean).length;
  const pendingCount = totalCount - completedCount;

  return (
    <div className="content-container">
      {/* Header */}
      <div className="meetings-controls-row">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>
            Action Items Tracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            All actionable tasks and deliverables extracted across your meetings.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={loadActions}>
          🔄 Refresh
        </button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="metric-card">
          <div className="metric-icon-wrap icon-blue">
            <span>📋</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Total Action Items</div>
            <div className="metric-value">{totalCount}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-amber">
            <span>⏳</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Pending Tasks</div>
            <div className="metric-value">{pendingCount}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-green">
            <span>✅</span>
          </div>
          <div className="metric-info">
            <div className="metric-label">Completed Tasks</div>
            <div className="metric-value">{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="search-input-wrap" style={{ maxWidth: '480px', marginBottom: '1.5rem' }}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Filter by task description, assignee, or meeting..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Action Items List */}
      {loading ? (
        <div className="action-items-container">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="action-card skeleton-box" style={{ height: '60px' }} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">☑️</div>
          <div className="empty-title">
            {search ? 'No Matching Tasks Found' : 'No Action Items Extracted Yet'}
          </div>
          <p className="empty-desc">
            {search 
              ? `No tasks match "${search}". Try a different filter.`
              : 'Action items will automatically appear here once you generate AI summaries from your meeting transcripts.'}
          </p>
        </div>
      ) : (
        <div className="action-items-container">
          {filteredItems.map((item, idx) => {
            const isDone = completedMap[idx];
            return (
              <div key={idx} className={`action-card ${isDone ? 'completed' : ''}`}>
                <div className="action-left">
                  <input
                    type="checkbox"
                    className="action-checkbox"
                    checked={!!isDone}
                    onChange={() => toggleTask(idx)}
                  />
                  <div>
                    <div className="action-task-title">
                      {item.task}
                    </div>
                    <div 
                      style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-muted)', 
                        marginTop: '0.2rem',
                        cursor: 'pointer' 
                      }}
                      onClick={() => onSelectMeeting(item.session_id)}
                    >
                      From: <span style={{ color: '#A5B4FC', textDecoration: 'underline' }}>{item.session_name}</span>
                    </div>
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
      )}
    </div>
  );
};

export default ActionItemsView;
