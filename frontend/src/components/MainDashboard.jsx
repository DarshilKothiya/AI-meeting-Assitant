import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Info,
  Person,
  Psychology,
  MenuBook,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import moment from 'moment';

import { webSocketService } from '../services/websocketService';
import { apiService } from '../services/apiService';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

const initialState = {
  isConnected: false,
  currentSession: null,
  sessionStatus: 'idle',
  chunks: [],
  finalSummary: null,
  statusMessages: [],
  error: null,
  sessionStats: {
    totalChunks: 0,
    totalDuration: 0,
    currentChunk: 0,
  },
};

const Dashboard = () => {
  const [state, setState] = useState(initialState);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [showError, setShowError] = useState(false);
  const chunksEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chunksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.chunks, scrollToBottom]);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await webSocketService.connect();

        webSocketService.onConnected(() => {
          setState(prev => ({ ...prev, isConnected: true, error: null }));
        });

        webSocketService.onDisconnected(() => {
          setState(prev => ({ ...prev, isConnected: false }));
        });

        webSocketService.onChunkUpdate((sessionId, chunk) => {
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return {
                ...prev,
                chunks: [...prev.chunks, chunk],
                sessionStats: {
                  ...prev.sessionStats,
                  totalChunks: prev.sessionStats.totalChunks + 1,
                  currentChunk: chunk.chunk_id,
                  totalDuration: chunk.end_time,
                },
              };
            }
            return prev;
          });
        });

        webSocketService.onSummaryUpdate((sessionId, summary) => {
          setState(prev => {
            if (sessionId === prev.currentSession) {
              return {
                ...prev,
                finalSummary: summary,
                sessionStatus: 'completed',
              };
            }
            return prev;
          });
        });

        webSocketService.onStatusUpdate((sessionId, status, details) => {
          const message = `${moment().format('HH:mm:ss')}: ${status}`;
          setState(prev => ({
            ...prev,
            statusMessages: [...prev.statusMessages.slice(-4), message],
          }));

          if (details?.error) {
            setState(prev => ({ ...prev, error: status, sessionStatus: 'error' }));
            setShowError(true);
          }
        });

        webSocketService.onError((error) => {
          setState(prev => ({ ...prev, error, isConnected: false }));
          setShowError(true);
        });

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: `Failed to connect: ${error}`,
          isConnected: false,
        }));
        setShowError(true);
      }
    };

    initializeConnection();

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  const handleStartSession = async () => {
    try {
      setState(prev => ({ ...prev, sessionStatus: 'starting', error: null }));

      const request = {
        session_name: sessionName || undefined,
        metadata: {
          started_by: 'dashboard',
          start_time: new Date().toISOString(),
        },
      };

      const response = await apiService.startSession(request);

      setState(prev => ({
        ...prev,
        currentSession: response.session_id,
        sessionStatus: 'active',
        chunks: [],
        finalSummary: null,
        statusMessages: [],
        sessionStats: { totalChunks: 0, totalDuration: 0, currentChunk: 0 },
      }));

      webSocketService.subscribeToSession(response.session_id);

      setShowStartDialog(false);
      setSessionName('');

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to start session: ${error}`,
        sessionStatus: 'error',
      }));
      setShowError(true);
    }
  };

  const handleStopSession = async () => {
    if (!state.currentSession) return;

    try {
      setState(prev => ({ ...prev, sessionStatus: 'stopping' }));

      await apiService.stopSession(state.currentSession);

      webSocketService.unsubscribeFromSession(state.currentSession);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to stop session: ${error}`,
        sessionStatus: 'error',
      }));
      setShowError(true);
    }
  };

  const getEmotionData = () => {
    const emotionCounts = {};

    state.chunks.forEach(chunk => {
      Object.values(chunk.emotions).forEach(emotion => {
        emotionCounts[emotion.dominant_emotion] =
          (emotionCounts[emotion.dominant_emotion] || 0) + 1;
      });
    });

    return Object.entries(emotionCounts).map(([emotion, count]) => ({
      name: emotion,
      value: count,
    }));
  };

  const getSpeakerData = () => {
    const speakerCounts = {};

    state.chunks.forEach(chunk => {
      chunk.speakers.speakers.forEach(speaker => {
        speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
      });
    });

    return Object.entries(speakerCounts).map(([speaker, count]) => ({
      name: speaker,
      value: count,
    }));
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Meeting Transcription Dashboard
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={state.isConnected ? <CheckCircle /> : <ErrorIcon />}
            label={state.isConnected ? 'Connected' : 'Disconnected'}
            color={state.isConnected ? 'success' : 'error'}
          />

          {state.sessionStatus === 'idle' && (
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => setShowStartDialog(true)}
              disabled={!state.isConnected}
            >
              Start Session
            </Button>
          )}

          {state.sessionStatus === 'active' && (
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={handleStopSession}
            >
              Stop Session
            </Button>
          )}

          {(state.sessionStatus === 'starting' || state.sessionStatus === 'stopping') && (
            <Button variant="contained" disabled>
              {state.sessionStatus === 'starting' ? 'Starting...' : 'Stopping...'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Session Info */}
      {state.currentSession && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Session ID</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {state.currentSession}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Duration</Typography>
                <Typography variant="body2">
                  {formatDuration(state.sessionStats.totalDuration)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Chunks Processed</Typography>
                <Typography variant="body2">
                  {state.sessionStats.totalChunks}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  label={state.sessionStatus}
                  color={state.sessionStatus === 'active' ? 'success' : 'default'}
                  size="small"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      {state.sessionStatus === 'active' && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ mt: 1 }}>
            Processing audio in real-time...
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Live Transcript */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2, height: '500px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              <MenuBook sx={{ mr: 1, verticalAlign: 'middle' }} />
              Live Transcript
            </Typography>

            {state.chunks.length === 0 && (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography color="textSecondary">
                  {state.sessionStatus === 'idle'
                    ? 'Start a session to see transcript'
                    : 'Waiting for audio...'}
                </Typography>
              </Box>
            )}

            {state.chunks.map((chunk) => (
              <Box
                key={chunk.chunk_id}
                sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2">
                    Chunk {chunk.chunk_id} ({formatDuration(chunk.start_time)} -{' '}
                    {formatDuration(chunk.end_time)})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {chunk.speakers.speakers.map(speaker => (
                      <Chip key={speaker} label={speaker} size="small" />
                    ))}
                  </Box>
                </Box>

                <Typography variant="body2">
                  {chunk.transcript.full_text}
                </Typography>

                {chunk.micro_summary && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}
                  >
                    Summary: {chunk.micro_summary}
                  </Typography>
                )}
              </Box>
            ))}

            <div ref={chunksEndRef} />
          </Paper>
        </Grid>

        {/* Analytics Panel */}
        <Grid item xs={12} lg={4}>
          <Grid container spacing={2}>
            {/* Emotions */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Emotions
                </Typography>

                {getEmotionData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getEmotionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getEmotionData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="textSecondary">No emotion data yet</Typography>
                )}
              </Paper>
            </Grid>

            {/* Speakers */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Speakers
                </Typography>

                {getSpeakerData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={getSpeakerData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={50}
                        fill="#82ca9d"
                        dataKey="value"
                      >
                        {getSpeakerData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="textSecondary">No speaker data yet</Typography>
                )}
              </Paper>
            </Grid>

            {/* Technical Terms */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Technical Terms
                </Typography>

                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {state.chunks
                    .flatMap(chunk => chunk.jargon)
                    .slice(-10)
                    .map((term, index) => (
                      <Tooltip key={index} title={term.definition}>
                        <Chip
                          label={term.term}
                          size="small"
                          sx={{ m: 0.5 }}
                          clickable
                        />
                      </Tooltip>
                    ))}

                  {state.chunks.length === 0 && (
                    <Typography color="textSecondary">
                      No technical terms detected yet
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Final Summary */}
      {state.finalSummary && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Meeting Summary
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Typography variant="body1">
                {state.finalSummary.final_summary}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Typography variant="body2">
                Total Duration: {formatDuration(state.finalSummary.total_duration)}
              </Typography>
              <Typography variant="body2">
                Total Chunks: {state.finalSummary.total_chunks}
              </Typography>
              <Typography variant="body2">
                Speakers:{' '}
                {Object.keys(state.finalSummary.speakers_summary).join(', ')}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Status Messages */}
      {state.statusMessages.length > 0 && (
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
            Status
          </Typography>

          {state.statusMessages.map((message, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ fontFamily: 'monospace' }}
            >
              {message}
            </Typography>
          ))}
        </Paper>
      )}

      {/* Start Session Dialog */}
      <Dialog
        open={showStartDialog}
        onClose={() => setShowStartDialog(false)}
      >
        <DialogTitle>Start New Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name (Optional)"
            fullWidth
            variant="outlined"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStartDialog(false)}>Cancel</Button>
          <Button onClick={handleStartSession} variant="contained">
            Start Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
      >
        <Alert severity="error" onClose={() => setShowError(false)}>
          {state.error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
