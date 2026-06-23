import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import PresenterMode from './components/PresenterMode';
import StudentMode from './components/StudentMode';

// Dynamic WebSocket URL resolution
export const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If running via dev server, Vite proxies '/ws' to backend
  return `${protocol}//${window.location.host}/ws`;
};

// Unique voterId generator and caching
const getOrCreateVoterId = () => {
  let voterId = localStorage.getItem('vibevote_voter_id');
  if (!voterId) {
    voterId = 'voter_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('vibevote_voter_id', voterId);
  }
  return voterId;
};

function App() {
  const [page, setPage] = useState('landing'); // 'landing', 'dashboard', 'presenter', 'student'
  const [presentationId, setPresentationId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [voterId, setVoterId] = useState('');

  useEffect(() => {
    setVoterId(getOrCreateVoterId());
  }, []);

  const handleJoinStudent = (code) => {
    setJoinCode(code);
    setPage('student');
  };

  const handleStartPresentation = (id) => {
    setPresentationId(id);
    setPage('presenter');
  };

  return (
    <div className="app-container">
      <div className="animated-bg"></div>
      <main className="main-content">
        {page === 'landing' && (
          <LandingPage 
            onJoinStudent={handleJoinStudent} 
            onEnterDashboard={() => setPage('dashboard')} 
          />
        )}
        
        {page === 'dashboard' && (
          <Dashboard 
            onStartPresentation={handleStartPresentation} 
            onBackToHome={() => setPage('landing')} 
          />
        )}

        {page === 'presenter' && (
          <PresenterMode 
            presentationId={presentationId} 
            onExit={() => setPage('dashboard')} 
          />
        )}

        {page === 'student' && (
          <StudentMode 
            joinCode={joinCode} 
            voterId={voterId} 
            onExit={() => setPage('landing')} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
