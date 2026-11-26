import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MeetingsList from './components/MeetingsList';
import MeetingDetails from './components/MeetingDetails';
import ActionItemsView from './components/ActionItemsView';
import AuthPage from './components/AuthPage';
import { webSocketService } from './services/websocketService';
import { apiService } from './services/apiService';

// Emotion aggregation helper
const deriveEmotions = (chunks) => {
  const counts = {};
  let total = 0;

  chunks.forEach((chunk) => {
    if (chunk.emotions && typeof chunk.emotions === 'object') {
      Object.values(chunk.emotions).forEach((emotionData) => {
        const emotion = emotionData?.dominant_emotion;
        if (emotion) {
          counts[emotion] = (counts[emotion] || 0) + 1;
          total += 1;
        }
      });
    }
  });

  return Object.entries(counts).map(([name, count]) => ({
    name,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
};

// Technical jargon terms helper
const deriveTerms = (chunks) => {
  const map = {};

  chunks.forEach((chunk) => {
    if (Array.isArray(chunk.jargon)) {
      chunk.jargon.forEach((j) => {
        const key = (j.term || '').toLowerCase();
        if (key) {
          if (!map[key]) {
            map[key] = { term: j.term, frequency: 0, definition: j.definition || '' };
          }
          map[key].frequency += 1;
        }
      });
    }
  });

  return Object.values(map).sort((a, b) => b.frequency - a.frequency);
};

function App() {
  const [user, setUser] = useState(() => apiService.getStoredUser());
  const [authChecking, setAuthChecking] = useState(() => Boolean(apiService.getToken()));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const [state, setState] = useState({
    isConnected: false,
    currentSession: null,
    currentSessionName: '',
    sessionStatus: 'idle', // idle, recording, completed
    chunks: [],
    finalSummary: null,
    error: null,
    sessionStats: {
      totalChunks: 0,
      totalDuration: 0,
      currentChunk: 0,
    },
    emotions: [],
    technicalTerms: [],
  });

  const handleLogout = () => {
    apiService.logout();
    webSocketService.disconnect();
    setUser(null);
    setActiveTab('dashboard');
    setSelectedMeetingId(null);
    setState({
      isConnected: false,
      currentSession: null,
      currentSessionName: '',
      sessionStatus: 'idle',
      chunks: [],
      finalSummary: null,
      error: null,
      sessionStats: {
        totalChunks: 0,
        totalDuration: 0,
        currentChunk: 0,
      },
      emotions: [],
      technicalTerms: [],
    });
  };

  // Verify existing auth token on mount
  useEffect(() => {
    apiService.setUnauthorizedHandler(() => {
      setUser(null);
      webSocketService.disconnect();
    });

    const token = apiService.getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    apiService
      .getMe()
      .then((me) => setUser(me))
      .catch(() => {
        apiService.logout();
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  // Initialize WebSocket and audio devices once authenticated
  useEffect(() => {
    if (!user) return;

    const initialize = async () => {
      try {
        // Load audio input devices
        try {
          const devices = await apiService.getAudioDevices();
          setAudioDevices(devices || []);
          if (devices && devices.length > 0) {
            setSelectedDevice(devices[0].device_id);
          }
        } catch (e) {
          console.warn('Audio devices fetch error:', e);
        }

        // Connect WebSocket
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
              const newChunks = [...prev.chunks, chunk];
              return {
                ...prev,
                chunks: newChunks,
                sessionStats: {
                  totalChunks: newChunks.length,
                  currentChunk: chunk.chunk_id,
                  totalDuration: chunk.end_time || prev.sessionStats.totalDuration,
                },
                emotions: deriveEmotions(newChunks),
                technicalTerms: deriveTerms(newChunks),
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

        webSocketService.onError((error) => {
          setState(prev => ({ 
            ...prev, 
            error: typeof error === 'string' ? error : error?.message || 'WebSocket error' 
          }));
        });
      } catch (err) {
        setState(prev => ({ ...prev, error: 'Failed to connect to backend service' }));
      }
    };

    initialize();

    return () => {
      webSocketService.disconnect();
    };
  }, [user]);

  const handleStartSession = async () => {
    try {
      const name = sessionName.trim() || `Meeting ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const sessionData = {
        session_name: name,
        metadata: {
          session_name: name,
          name: name,
          device_id: selectedDevice,
        },
      };

      const response = await apiService.startSession(sessionData);

      setState(prev => ({
        ...prev,
        currentSession: response.session_id,
        currentSessionName: name,
        sessionStatus: 'recording',
        chunks: [],
        finalSummary: null,
        error: null,
        sessionStats: {
          totalChunks: 0,
          totalDuration: 0,
          currentChunk: 0,
        },
        emotions: [],
        technicalTerms: [],
      }));

      webSocketService.subscribeToSession(response.session_id);
      setShowStartDialog(false);
      setSessionName('');
      setActiveTab('live');
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to start recording session: ' + err.message }));
    }
  };

  const handleStopSession = async () => {
    try {
      if (state.currentSession) {
        webSocketService.unsubscribeFromSession(state.currentSession);
        await apiService.stopSession(state.currentSession);
        
        const completedId = state.currentSession;
        setState(prev => ({
          ...prev,
          sessionStatus: 'completed',
        }));

        // Switch to Meeting Details view for immediate summary generation!
        setSelectedMeetingId(completedId);
        setActiveTab('details');
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to stop session: ' + err.message }));
    }
  };

  const handleSelectMeeting = (meetingId) => {
    setSelectedMeetingId(meetingId);
    setActiveTab('details');
  };

  if (authChecking) {
    return (
      <div className="auth-shell">
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)' }}>Loading Nexora - Meeting Assistant...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'details') {
            setSelectedMeetingId(null);
          }
          setActiveTab(tab);
        }}
        isConnected={state.isConnected}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Navbar */}
        <Navbar
          sessionStatus={state.sessionStatus}
          activeSessionName={state.currentSessionName}
          onStartSession={() => setShowStartDialog(true)}
          onStopSession={handleStopSession}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          audioDevices={audioDevices}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
        />

        {/* View Routing */}
        {activeTab === 'details' && selectedMeetingId && (
          <MeetingDetails
            meetingId={selectedMeetingId}
            onBack={() => setActiveTab('meetings')}
          />
        )}

        {activeTab === 'meetings' && (
          <MeetingsList
            onSelectMeeting={handleSelectMeeting}
            onStartNewMeeting={() => setShowStartDialog(true)}
          />
        )}

        {activeTab === 'summaries' && (
          <MeetingsList
            onSelectMeeting={handleSelectMeeting}
            onStartNewMeeting={() => setShowStartDialog(true)}
          />
        )}

        {activeTab === 'action-items' && (
          <ActionItemsView
            onSelectMeeting={handleSelectMeeting}
          />
        )}

        {(activeTab === 'dashboard' || activeTab === 'live') && (
          <Dashboard
            state={state}
            onStartSession={handleStartSession}
            onStopSession={handleStopSession}
            onViewMeetingSummary={(id) => {
              setSelectedMeetingId(id);
              setActiveTab('details');
            }}
            showStartDialog={showStartDialog}
            setShowStartDialog={setShowStartDialog}
            sessionName={sessionName}
            setSessionName={setSessionName}
          />
        )}
      </div>
    </div>
  );
}

export default App;
