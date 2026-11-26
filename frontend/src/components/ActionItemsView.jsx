import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import StatCard from './StatCard';
import {
  CheckSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  RefreshIcon,
  SearchIcon,
} from './Icons';

const ActionItemsView = ({ onSelectMeeting }) => {
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [completedMap, setCompletedMap] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_global_action_items');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  const toggleTask = (taskKey) => {
    setCompletedMap((prev) => {
      const next = { ...prev, [taskKey]: !prev[taskKey] };
      try {
        localStorage.setItem('nexora_global_action_items', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const filteredItems = actionItems.filter((item) => {
    const term = search.toLowerCase();
    return (
      (item.task || '').toLowerCase().includes(term) ||
      (item.assignee || '').toLowerCase().includes(term) ||
      (item.session_name || '').toLowerCase().includes(term)
    );
  });

  const totalCount = actionItems.length;
  const completedCount = actionItems.filter((item, idx) => completedMap[`${item.session_id}_${idx}`]).length;
  const pendingCount = Math.max(0, totalCount - completedCount);

  return (
    <div className="content-container">
      {/* Header */}
      <div className="meetings-controls-row">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Action Items Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            All actionable tasks and deliverables extracted across your meetings.
          </p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={loadActions}>
          <RefreshIcon size={15} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <StatCard icon={<CheckSquareIcon size={20} />} tone="blue" label="Total Action Items" value={totalCount} />
        <StatCard icon={<ClockIcon size={20} />} tone="amber" label="Pending Tasks" value={pendingCount} />
        <StatCard icon={<CheckCircleIcon size={20} />} tone="green" label="Completed Tasks" value={completedCount} />
      </div>

      {/* Search Input */}
      <div className="search-input-wrap" style={{ maxWidth: '460px', marginBottom: '1.35rem' }}>
        <span className="search-icon">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          className="search-input"
          placeholder="Filter by task, assignee, or meeting..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Action Items List */}
      {loading ? (
        <div className="action-items-container">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-box" style={{ height: '64px' }} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <CheckSquareIcon size={24} />
          </div>
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
            const taskKey = `${item.session_id}_${idx}`;
            const isDone = completedMap[taskKey];
            return (
              <div key={taskKey} className={`action-card ${isDone ? 'completed' : ''}`}>
                <div className="action-left">
                  <input
                    type="checkbox"
                    className="action-checkbox"
                    checked={!!isDone}
                    onChange={() => toggleTask(taskKey)}
                  />
                  <div>
                    <div className="action-task-title">{item.task}</div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.2rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => onSelectMeeting(item.session_id)}
                    >
                      From meeting:{' '}
                      <span style={{ color: 'var(--ai-primary)', fontWeight: 600 }}>
                        {item.session_name || item.session_id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="action-tags">
                  {item.assignee && item.assignee !== 'Not mentioned' && (
                    <span className="tag-badge tag-assignee">{item.assignee}</span>
                  )}
                  {item.deadline && item.deadline !== 'Not mentioned' && (
                    <span className="tag-badge tag-deadline">{item.deadline}</span>
                  )}
                  {item.status && item.status !== 'Not mentioned' && (
                    <span className="tag-badge tag-status">{item.status}</span>
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
