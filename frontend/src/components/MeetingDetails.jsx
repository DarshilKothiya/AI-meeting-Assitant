import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { apiService } from '../services/apiService';
import {
  ArrowLeftIcon,
  SparklesIcon,
  RefreshIcon,
  TrashIcon,
  DownloadIcon,
  ChevronDownIcon,
  FileTextIcon,
  CheckSquareIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ActivityIcon,
  TagIcon,
  UsersIcon,
  SearchIcon,
  ZapIcon,
} from './Icons';

const MeetingDetails = ({ meetingId, onBack, onNotify }) => {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(1);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [error, setError] = useState(null);
  const [transcriptFilter, setTranscriptFilter] = useState('');
  const [completedTasks, setCompletedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(`nexora_tasks_${meetingId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      try {
        const saved = localStorage.getItem(`nexora_tasks_${meetingId}`);
        setCompletedTasks(saved ? JSON.parse(saved) : {});
      } catch {
        setCompletedTasks({});
      }
    }
  }, [meetingId, loadMeeting]);

  const handleDeleteMeeting = async () => {
    try {
      setIsDeleting(true);
      await apiService.deleteMeeting(meetingId);
      setShowDeleteModal(false);
      onNotify?.({
        type: 'success',
        title: 'Meeting Deleted',
        message: 'Meeting session and summary deleted permanently.',
      });
      onBack();
    } catch (err) {
      onNotify?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Unknown error',
      });
      setIsDeleting(false);
    }
  };

  const handleGenerateSummary = async (forceRegenerate = false) => {
    try {
      setIsGenerating(true);
      setError(null);
      setGeneratingStep(1);

      const stepTimer1 = setTimeout(() => setGeneratingStep(2), 1200);
      const stepTimer2 = setTimeout(() => setGeneratingStep(3), 2800);

      const response = await apiService.generateMeetingSummary(meetingId, forceRegenerate);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setMeeting((prev) => ({
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
      onNotify?.({
        type: 'success',
        title: 'AI Summary Ready',
        message: 'Structured meeting report generated via Groq LLM.',
      });
    } catch (err) {
      const msg = err.message || 'Unable to generate summary. Please ensure GROQ_API_KEY is configured.';
      setError(msg);
      onNotify?.({
        type: 'error',
        title: 'Summary Generation Failed',
        message: msg,
      });
    } finally {
      setIsGenerating(false);
      setGeneratingStep(1);
    }
  };

  const toggleTask = (taskIndex) => {
    setCompletedTasks((prev) => {
      const next = { ...prev, [taskIndex]: !prev[taskIndex] };
      try {
        localStorage.setItem(`nexora_tasks_${meetingId}`, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Compute real emotion distribution from meeting chunks
  const emotionChartData = useMemo(() => {
    if (!meeting?.chunks || !Array.isArray(meeting.chunks)) return [];
    const counts = {};
    meeting.chunks.forEach((chunk) => {
      if (chunk.emotions && typeof chunk.emotions === 'object') {
        Object.values(chunk.emotions).forEach((em) => {
          const label = em?.dominant_emotion;
          if (label) {
            counts[label] = (counts[label] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts)
      .map(([emotion, count]) => ({
        emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
        chunks: count,
      }))
      .sort((a, b) => b.chunks - a.chunks);
  }, [meeting]);

  // Combine key topics & jargon keywords from real chunks
  const keywordCloud = useMemo(() => {
    const map = new Map();
    if (meeting?.summary?.key_topics) {
      meeting.summary.key_topics.forEach((t) => {
        const clean = String(t).trim();
        if (clean) map.set(clean.toLowerCase(), clean);
      });
    }
    if (Array.isArray(meeting?.chunks)) {
      meeting.chunks.forEach((c) => {
        if (Array.isArray(c.jargon)) {
          c.jargon.forEach((j) => {
            const clean = String(j.term || '').trim();
            if (clean && !map.has(clean.toLowerCase())) {
              map.set(clean.toLowerCase(), clean);
            }
          });
        }
      });
    }
    return Array.from(map.values()).slice(0, 24);
  }, [meeting]);

  // Export handlers (TXT, Markdown, PDF via print)
  const buildPlainTextReport = () => {
    const s = meeting?.summary;
    const lines = [
      `NEXORA - MEETING INTELLIGENCE REPORT`,
      `==================================================`,
      `Title: ${meeting?.session_name || 'Meeting Session'}`,
      `Date: ${formatDate(meeting?.start_time)}`,
      `Duration: ${formatDuration(meeting?.duration_seconds)}`,
      `Session ID: ${meeting?.session_id}`,
      ``,
    ];
    if (s) {
      if (s.concise_summary) lines.push(`EXECUTIVE TAKEAWAY:\n${s.concise_summary}\n`);
      lines.push(`MEETING OVERVIEW:\n${s.meeting_overview || 'N/A'}\n`);
      lines.push(`EXECUTIVE SUMMARY:\n${s.executive_summary || 'N/A'}\n`);
      if (s.key_points?.length) {
        lines.push(`KEY DISCUSSION POINTS:\n${s.key_points.map((p) => `- ${p}`).join('\n')}\n`);
      }
      if (s.decisions_made?.length) {
        lines.push(`DECISIONS MADE:\n${s.decisions_made.map((d) => `- ${d}`).join('\n')}\n`);
      }
      if (s.action_items?.length) {
        lines.push(
          `ACTION ITEMS:\n${s.action_items
            .map((a, idx) => `- [${completedTasks[idx] ? 'x' : ' '}] ${a.task} (Owner: ${a.assignee || 'N/A'}, Due: ${a.deadline || 'N/A'})`)
            .join('\n')}\n`
        );
      }
    }
    lines.push(`COMPLETE TRANSCRIPT:\n${meeting?.combined_transcript || 'No transcript available.'}`);
    return lines.join('\n');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    const safeName = (meeting?.session_name || 'meeting-report').replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();

    if (format === 'txt') {
      downloadFile(buildPlainTextReport(), `${safeName}.txt`, 'text/plain;charset=utf-8');
      onNotify?.({ type: 'success', title: 'Exported TXT', message: `Saved ${safeName}.txt` });
      return;
    }

    if (format === 'md') {
      const s = meeting?.summary;
      const md = [
        `# ${meeting?.session_name || 'Meeting Intelligence Report'}`,
        `- **Date:** ${formatDate(meeting?.start_time)}`,
        `- **Duration:** ${formatDuration(meeting?.duration_seconds)}`,
        `- **Session ID:** \`${meeting?.session_id}\``,
        '',
        s?.concise_summary ? `> **Executive Takeaway:** ${s.concise_summary}\n` : '',
        s ? `## Meeting Overview\n${s.meeting_overview}\n` : '',
        s ? `## Executive Summary\n${s.executive_summary}\n` : '',
        s?.key_points?.length ? `## Key Discussion Points\n${s.key_points.map((p) => `- ${p}`).join('\n')}\n` : '',
        s?.decisions_made?.length ? `## Decisions Made\n${s.decisions_made.map((d) => `- ${d}`).join('\n')}\n` : '',
        s?.action_items?.length
          ? `## Action Items\n${s.action_items
              .map((a, idx) => `- [${completedTasks[idx] ? 'x' : ' '}] **${a.task}** — *${a.assignee || 'Unassigned'}* (${a.deadline || 'No deadline'})`)
              .join('\n')}\n`
          : '',
        `## Complete Transcript\n\`\`\`\n${meeting?.combined_transcript || 'No transcript available.'}\n\`\`\``,
      ].join('\n');
      downloadFile(md, `${safeName}.md`, 'text/markdown;charset=utf-8');
      onNotify?.({ type: 'success', title: 'Exported Markdown', message: `Saved ${safeName}.md` });
      return;
    }

    if (format === 'pdf') {
      const printWin = window.open('', '_blank', 'width=900,height=700');
      if (!printWin) {
        onNotify?.({ type: 'error', title: 'Popup Blocked', message: 'Allow popups to export as PDF.' });
        return;
      }
      const s = meeting?.summary;
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>${meeting?.session_name || 'Nexora Meeting Report'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 36px; line-height: 1.6; max-width: 820px; margin: 0 auto; }
    h1 { color: #1976D2; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    .callout { background: #eff6ff; border-left: 4px solid #1976D2; padding: 12px 16px; margin-bottom: 20px; }
    h2 { font-size: 16px; color: #1e293b; margin-top: 22px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    ul { padding-left: 20px; }
    pre { white-space: pre-wrap; font-family: inherit; background: #f8fafc; padding: 14px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${meeting?.session_name || 'Nexora Meeting Report'}</h1>
  <div class="meta">Date: ${formatDate(meeting?.start_time)} • Duration: ${formatDuration(meeting?.duration_seconds)}</div>
  ${s?.concise_summary ? `<div class="callout"><strong>Executive Takeaway:</strong> ${s.concise_summary}</div>` : ''}
  ${s ? `<h2>Meeting Overview</h2><p>${s.meeting_overview || ''}</p>` : ''}
  ${s ? `<h2>Executive Summary</h2><p>${s.executive_summary || ''}</p>` : ''}
  ${s?.key_points?.length ? `<h2>Key Discussion Points</h2><ul>${s.key_points.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
  ${s?.decisions_made?.length ? `<h2>Decisions Made</h2><ul>${s.decisions_made.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}
  ${s?.action_items?.length ? `<h2>Action Items</h2><ul>${s.action_items.map((a) => `<li><strong>${a.task}</strong> (${a.assignee || 'Not mentioned'}, Due: ${a.deadline || 'Not mentioned'})</li>`).join('')}</ul>` : ''}
  <h2>Complete Transcript</h2>
  <pre>${meeting?.combined_transcript || 'No transcript available.'}</pre>
</body>
</html>`;
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 300);
    }
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Loading meeting report...</p>
        </div>
      </div>
    );
  }

  if (!meeting && error) {
    return (
      <div className="content-container">
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1.5rem' }}>
          <ArrowLeftIcon size={15} />
          <span>Back to Meetings</span>
        </button>
        <div className="empty-state">
          <div className="empty-icon" style={{ color: 'var(--ai-rose)', background: 'rgba(239, 68, 68, 0.12)' }}>
            <AlertCircleIcon size={24} />
          </div>
          <div className="empty-title">Failed to Load Meeting</div>
          <p className="empty-desc">{error}</p>
          <button type="button" className="btn btn-primary" onClick={loadMeeting}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = meeting?.summary;
  const metadata = meeting?.summary_metadata;
  const transcriptLines = (meeting?.combined_transcript || '').split('\n').filter((l) => l.trim().length > 0);
  const filteredTranscript = transcriptLines.filter((l) =>
    l.toLowerCase().includes(transcriptFilter.toLowerCase())
  );

  return (
    <div className="content-container">
      {/* Top Navigation & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.35rem', flexWrap: 'wrap', gap: '0.85rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeftIcon size={15} />
          <span>Back to Meetings</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span className={`badge ${meeting?.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
            {meeting?.status === 'active' ? 'Live Recording' : 'Completed'}
          </span>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {formatDuration(meeting?.duration_seconds)}
          </span>

          {/* Export Dropdown */}
          <div className="dropdown-wrap">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowExportMenu((prev) => !prev)}
            >
              <DownloadIcon size={15} />
              <span>Export</span>
              <ChevronDownIcon size={14} />
            </button>
            {showExportMenu && (
              <div className="dropdown-menu">
                <button type="button" className="dropdown-item" onClick={() => handleExport('pdf')}>
                  <FileTextIcon size={15} />
                  <span>Print / Save as PDF</span>
                </button>
                <button type="button" className="dropdown-item" onClick={() => handleExport('txt')}>
                  <FileTextIcon size={15} />
                  <span>Download TXT</span>
                </button>
                <button type="button" className="dropdown-item" onClick={() => handleExport('md')}>
                  <FileTextIcon size={15} />
                  <span>Download Markdown</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => setShowDeleteModal(true)}
          >
            <TrashIcon size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Title Banner */}
      <div style={{ marginBottom: '1.65rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
          {meeting?.session_name || 'Meeting Intelligence Report'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
          {formatDate(meeting?.start_time)} • {meeting?.total_chunks || 0} audio chunks • ID:{' '}
          <code style={{ color: 'var(--ai-primary)' }}>{meeting?.session_id}</code>
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="auth-error" style={{ justifyContent: 'space-between', marginBottom: '1.35rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircleIcon size={16} />
            <span>
              <strong>Error:</strong> {error}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleGenerateSummary(false)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* AI Summary Hero */}
      <div className="summary-hero-card">
        <div className="summary-header-row">
          <div className="summary-title-wrap">
            <span style={{ color: 'var(--ai-primary)', display: 'flex' }}>
              <SparklesIcon size={21} />
            </span>
            <div className="summary-title">AI Meeting Intelligence</div>
            {summary && metadata?.model_used && (
              <div className="model-badge">Groq • {metadata.model_used}</div>
            )}
          </div>

          <div>
            {summary ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRegenModal(true)}
                disabled={isGenerating}
              >
                <RefreshIcon size={15} />
                <span>Regenerate</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ai-sparkle"
                onClick={() => handleGenerateSummary(false)}
                disabled={isGenerating}
              >
                <SparklesIcon size={15} />
                <span>Generate AI Summary</span>
              </button>
            )}
          </div>
        </div>

        {isGenerating && (
          <div className="loading-container" style={{ padding: '2.5rem 1rem' }}>
            <div className="spinner" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                {generatingStep === 1 && 'Extracting transcript and sending to Groq LLM...'}
                {generatingStep === 2 && 'Structuring key points, decisions, and action items...'}
                {generatingStep === 3 && 'Finalizing AI Meeting Intelligence Report...'}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Powered by LangChain & Groq Inference
              </p>
            </div>
          </div>
        )}

        {!isGenerating && !summary && (
          <div className="empty-state" style={{ background: 'transparent', border: 'none', padding: '2rem 1rem' }}>
            <div className="empty-icon">
              <SparklesIcon size={24} />
            </div>
            <div className="empty-title">No AI Summary Generated Yet</div>
            <p className="empty-desc">
              Generate an executive summary, key discussion points, decisions made, and assigned action items using Groq LLM.
            </p>
            <button
              type="button"
              className="btn btn-ai-sparkle"
              onClick={() => handleGenerateSummary(false)}
              style={{ padding: '0.7rem 1.5rem' }}
            >
              <SparklesIcon size={16} />
              <span>Generate AI Summary</span>
            </button>
          </div>
        )}

        {!isGenerating && summary && (
          <div>
            {summary.concise_summary && (
              <div className="concise-takeaway-banner">
                <div className="concise-takeaway-label">
                  <ZapIcon size={13} />
                  <span>Executive Takeaway</span>
                </div>
                <div className="concise-takeaway-text">{summary.concise_summary}</div>
              </div>
            )}

            <div className="summary-sections-grid">
              <div className="summary-box">
                <div className="summary-box-title">
                  <FileTextIcon size={16} />
                  <span>Meeting Overview</span>
                </div>
                <div className="summary-box-content">{summary.meeting_overview || 'Not mentioned'}</div>
              </div>

              <div className="summary-box">
                <div className="summary-box-title">
                  <SparklesIcon size={16} />
                  <span>Executive Summary</span>
                </div>
                <div className="summary-box-content">{summary.executive_summary || 'Not mentioned'}</div>
              </div>
            </div>

            <div className="summary-sections-grid">
              <div className="summary-box">
                <div className="summary-box-title">
                  <ZapIcon size={16} />
                  <span>Key Discussion Points</span>
                </div>
                {summary.key_points?.length > 0 ? (
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

              <div className="summary-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div className="summary-box-title" style={{ color: 'var(--ai-emerald)' }}>
                  <CheckCircleIcon size={16} />
                  <span>Decisions Made</span>
                </div>
                {summary.decisions_made?.length > 0 ? (
                  <ul className="points-list">
                    {summary.decisions_made.map((dec, i) => (
                      <li key={i} className="point-item">
                        <span style={{ color: 'var(--ai-emerald)', marginTop: '0.15rem', flexShrink: 0 }}>
                          <CheckCircleIcon size={14} />
                        </span>
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No explicit decisions recorded</p>
                )}
              </div>
            </div>

            {/* Action Items */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem' }}>
                <CheckSquareIcon size={18} />
                <span>Action Items & Deliverables</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  ({summary.action_items?.length || 0})
                </span>
              </h3>

              {summary.action_items?.length > 0 ? (
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
                          <div className="action-task-title">{item.task}</div>
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
              ) : (
                <div className="empty-state" style={{ padding: '1.25rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No action items identified in this transcript.
                  </p>
                </div>
              )}
            </div>

            {/* Open Questions & Participants / Follow-ups */}
            <div className="summary-sections-grid">
              <div className="summary-box" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <div className="summary-box-title" style={{ color: 'var(--ai-amber)' }}>
                  <AlertCircleIcon size={16} />
                  <span>Open Questions & Blockers</span>
                </div>
                {summary.questions_and_issues?.length > 0 ? (
                  <ul className="points-list">
                    {summary.questions_and_issues.map((q, i) => (
                      <li key={i} className="point-item">
                        <div className="point-dot" style={{ backgroundColor: 'var(--ai-amber)' }} />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No open questions recorded</p>
                )}
              </div>

              <div className="summary-box">
                <div className="summary-box-title">
                  <UsersIcon size={16} />
                  <span>Participants & Follow-ups</span>
                </div>
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Mentioned Participants
                  </div>
                  <div className="topics-pills-row">
                    {summary.participants?.length > 0 ? (
                      summary.participants.map((p, i) => (
                        <span key={i} className="topic-pill">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Not mentioned</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Follow-up Items
                  </div>
                  {summary.follow_up_items?.length > 0 ? (
                    <ul className="points-list">
                      {summary.follow_up_items.map((fu, i) => (
                        <li key={i} className="point-item">
                          <div className="point-dot" style={{ backgroundColor: 'var(--ai-cyan)' }} />
                          <span>{fu}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>No follow-up items scheduled</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Emotion Distribution Chart & Keyword Cloud */}
      {(emotionChartData.length > 0 || keywordCloud.length > 0) && (
        <div className="summary-sections-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ActivityIcon size={17} />
                <span>Emotion Distribution</span>
              </div>
            </div>
            <div className="card-body" style={{ height: '240px' }}>
              {emotionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emotionChartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="emotion" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-card)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                      }}
                    />
                    <Bar dataKey="chunks" fill="#1976D2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No emotion data recorded for this meeting.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <TagIcon size={17} />
                <span>Key Topics & Keywords</span>
              </div>
            </div>
            <div className="card-body">
              {keywordCloud.length > 0 ? (
                <div className="topics-pills-row">
                  {keywordCloud.map((kw, i) => (
                    <span key={i} className="topic-pill">
                      #{kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No keywords extracted yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Transcript */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileTextIcon size={17} />
            <span>Complete Transcript</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ({transcriptLines.length} segments)
            </span>
          </div>

          <div className="search-input-wrap" style={{ maxWidth: '260px', minWidth: '180px' }}>
            <span className="search-icon">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              className="search-input"
              style={{ padding: '0.42rem 0.75rem 0.42rem 2.1rem', fontSize: '0.82rem' }}
              placeholder="Search transcript..."
              value={transcriptFilter}
              onChange={(e) => setTranscriptFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="card-body" style={{ maxHeight: '460px', overflowY: 'auto' }}>
          {transcriptLines.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem', border: 'none' }}>
              <p style={{ color: 'var(--text-muted)' }}>No transcribed speech available for this meeting.</p>
            </div>
          ) : filteredTranscript.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem', border: 'none' }}>
              <p style={{ color: 'var(--text-muted)' }}>No matching lines found for "{transcriptFilter}".</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredTranscript.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.7rem 0.9rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.9rem',
                    lineHeight: 1.55,
                    color: 'var(--text-main)',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Regenerate Modal */}
      {showRegenModal && (
        <div className="modal-backdrop" onClick={() => setShowRegenModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Regenerate AI Summary?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              This will re-analyze the full transcript using Groq LLM to extract updated insights, decisions, and action items.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRegenModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-ai-sparkle" onClick={() => handleGenerateSummary(true)}>
                Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--ai-rose)' }}>
              <TrashIcon size={20} />
              <h3 className="modal-title">Delete This Meeting?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--text-main)' }}>"{meeting?.session_name || meetingId}"</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeleting}
                onClick={handleDeleteMeeting}
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

export default MeetingDetails;
