import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import PresenterMode from './components/PresenterMode';
import StudentMode from './components/StudentMode';

// Determine Vercel routing
const isVercel = () => {
  return window.location.hostname.includes('vercel.app') || 
         (!window.location.port && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('192.168.'));
};

// Resolve API paths (local dev uses Vite proxy, Vercel monorepo maps to route prefix)
export const getApiUrl = (path) => {
  if (isVercel()) {
    return `/_/backend${path}`;
  }
  return path;
};

// Dynamic WebSocket URL resolution
export const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (isVercel()) {
    return `${protocol}//${window.location.host}/_/backend/ws`;
  }
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
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('vibevote_admin_password') || '';
  });

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

  const handleEnterDashboard = (password) => {
    setAdminPassword(password);
    localStorage.setItem('vibevote_admin_password', password);
    setPage('dashboard');
  };

  const handleLogout = () => {
    setAdminPassword('');
    localStorage.removeItem('vibevote_admin_password');
    setPage('landing');
  };

  return (
    <div className="app-container">
      <div className="animated-bg"></div>
      <main className="main-content">
        {page === 'landing' && (
          <LandingPage 
            onJoinStudent={handleJoinStudent} 
            onEnterDashboard={handleEnterDashboard} 
            savedAdminPassword={adminPassword}
          />
        )}
        
        {page === 'dashboard' && (
          <Dashboard 
            adminPassword={adminPassword}
            onStartPresentation={handleStartPresentation} 
            onBackToHome={() => setPage('landing')} 
            onLogout={handleLogout}
          />
        )}

        {page === 'presenter' && (
          <PresenterMode 
            presentationId={presentationId} 
            adminPassword={adminPassword}
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
