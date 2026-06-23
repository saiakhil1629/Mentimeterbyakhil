import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, X, Eye, EyeOff, Trash2, QrCode, 
  HelpCircle, Users, Sparkles 
} from 'lucide-react';
import { getWebSocketUrl, getApiUrl } from '../App';

function PresenterMode({ presentationId, adminPassword, onExit }) {
  const [presentation, setPresentation] = useState(null);
  const [showResults, setShowResults] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [connected, setConnected] = useState(false);
  
  const wsRef = useRef(null);

  const activeIdx = presentation?.activeSlideIndex ?? 0;
  const activeSlide = presentation?.slides[activeIdx];
  const joinUrl = `${window.location.protocol}//${window.location.host}`;
  const totalVotes = activeSlide?.submissions?.length ?? 0;

  // Setup WebSocket connection
  useEffect(() => {
    connectWS();
    
    // Add Keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (wsRef.current) wsRef.current.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [presentationId, activeIdx]); // Restart WS if presentationId changes, bind activeIdx for keydown scopes

  const connectWS = () => {
    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Init as presenter
      ws.send(JSON.stringify({
        type: 'init',
        role: 'presenter',
        presentationId,
        password: adminPassword
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'sync') {
          setPresentation(message.presentation);
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Retry connection after 3s
      setTimeout(connectWS, 3000);
    };
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'Escape') {
      onExit();
    } else if (e.key.toLowerCase() === 'c') {
      handleClearResults();
    } else if (e.key.toLowerCase() === 'h') {
      setShowResults(prev => !prev);
    }
  };

  const handleNext = () => {
    if (!presentation) return;
    const nextIdx = activeIdx + 1;
    if (nextIdx < presentation.slides.length) {
      changeSlide(nextIdx);
    }
  };

  const handlePrev = () => {
    if (!presentation) return;
    const prevIdx = activeIdx - 1;
    if (prevIdx >= 0) {
      changeSlide(prevIdx);
    }
  };

  const changeSlide = (idx) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'slide_change',
        index: idx
      }));
    }
  };

  const handleClearResults = async () => {
    if (!presentation || !activeSlide) return;
    if (!window.confirm("Clear all responses for the current slide?")) return;
    
    try {
      await fetch(getApiUrl(`/api/presentations/${presentation.id}/slides/${activeSlide.id}/clear`), {
        method: 'POST',
        headers: { 'Authorization': adminPassword }
      });
      // WebSocket sync will broadcast the cleared results
    } catch (err) {
      console.error("Error clearing results:", err);
    }
  };

  // Multiple Choice result aggregator
  const getMultipleChoiceResults = () => {
    if (!activeSlide || activeSlide.type !== 'multiple-choice') return [];
    
    // Count votes for each index
    const counts = Array(activeSlide.options.length).fill(0);
    activeSlide.submissions.forEach(sub => {
      const optIdx = parseInt(sub.value);
      if (optIdx >= 0 && optIdx < counts.length) {
        counts[optIdx]++;
      }
    });

    return activeSlide.options.map((opt, idx) => {
      const count = counts[idx];
      const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return { option: opt, count, percent };
    });
  };

  // Word Cloud aggregator
  const getWordCloudResults = () => {
    if (!activeSlide || activeSlide.type !== 'word-cloud') return [];

    const wordCounts = {};
    activeSlide.submissions.forEach(sub => {
      // Students can enter multiple words split by commas or spaces
      const words = sub.value.split(/[,;\s]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
      words.forEach(w => {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });

    // Map to custom sizes & colors
    const words = Object.keys(wordCounts).map(word => ({
      text: word,
      count: wordCounts[word]
    }));

    // Sort by count
    words.sort((a, b) => b.count - a.count);
    return words;
  };

  // Scales rating aggregator
  const getScaleResults = () => {
    if (!activeSlide || activeSlide.type !== 'scales') return [];

    const sums = Array(activeSlide.options.length).fill(0);
    activeSlide.submissions.forEach(sub => {
      const ratings = sub.value; // Expect array of numbers, e.g. [4, 5, 2]
      if (Array.isArray(ratings)) {
        ratings.forEach((val, idx) => {
          if (idx < sums.length) {
            sums[idx] += parseFloat(val);
          }
        });
      }
    });

    return activeSlide.options.map((opt, idx) => {
      const avg = totalVotes > 0 ? (sums[idx] / totalVotes).toFixed(1) : '0.0';
      const percentage = (parseFloat(avg) / 5) * 100; // Assuming rating is out of 5
      return { label: opt, average: avg, percentage };
    });
  };

  const getWordStyle = (count, index) => {
    const minSize = 1.2; // rem
    const maxSize = 3.5; // rem
    const size = Math.min(maxSize, minSize + (count - 1) * 0.4);
    
    // Aesthetic text gradients/colors
    const colors = [
      '#6366f1', '#06b6d4', '#d946ef', '#10b981', '#f59e0b', 
      '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'
    ];
    
    return {
      fontSize: `${size}rem`,
      color: colors[index % colors.length],
      margin: '8px 16px',
      transform: `rotate(${(index % 3) * 5 - 5}deg)`,
      fontWeight: 'bold',
      textShadow: '0 4px 10px rgba(0,0,0,0.4)',
      transition: 'all 0.5s ease'
    };
  };

  if (!presentation) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingPulse}></div>
        <p style={{ marginTop: '20px', color: 'var(--text-dark-secondary)' }}>Connecting live feed...</p>
      </div>
    );
  }

  const mcResults = getMultipleChoiceResults();
  const wcResults = getWordCloudResults();
  const scaleResults = getScaleResults();

  return (
    <div style={styles.fullscreenBg}>
      {/* Top Banner - Joining details */}
      <header style={styles.topBanner}>
        <div style={styles.bannerDetails}>
          <span style={styles.bannerText}>Go to <strong>{joinUrl}</strong></span>
          <div style={styles.bannerCodeCard}>
            <span style={styles.bannerCodeLabel}>CODE</span>
            <span style={styles.bannerCode}>{presentation.code}</span>
          </div>
        </div>

        <div style={styles.bannerActions}>
          <button onClick={() => setShowQR(prev => !prev)} className="btn-secondary" style={styles.topBtn} title="Show QR Code">
            <QrCode size={16} /> QR
          </button>
          
          <div style={styles.statusBadge}>
            <Users size={16} />
            <span>{totalVotes} Voted</span>
          </div>
          
          {!connected && <span style={styles.reconnectingBadge}>Reconnecting...</span>}
        </div>
      </header>

      {/* Main Slide Content Area */}
      <div style={styles.slideDisplayArea}>
        <div style={styles.slideContentWrapper}>
          <h1 style={styles.slideQuestion}>{activeSlide?.question || "No Question"}</h1>

          {/* Results display box */}
          {showResults ? (
            <div style={styles.visualisationPanel}>
              
              {/* Type 1: Multiple Choice */}
              {activeSlide?.type === 'multiple-choice' && (
                <div style={styles.mcWrapper}>
                  {mcResults.map((res, i) => (
                    <div key={i} className="poll-bar-container">
                      <div className="poll-bar-track">
                        <div 
                          className="poll-bar-fill" 
                          style={{ width: `${res.percent}%` }}
                        ></div>
                        <div className="poll-bar-text">
                          <span>{res.option}</span>
                          <span>{res.count} ({res.percent}%)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {totalVotes === 0 && (
                    <div style={styles.emptyPrompt}>
                      <Users size={40} color="var(--text-dark-muted)" />
                      <p>Waiting for responses...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Type 2: Word Cloud */}
              {activeSlide?.type === 'word-cloud' && (
                <div className="word-cloud-container">
                  {wcResults.map((word, i) => (
                    <span 
                      key={i} 
                      className="word-cloud-item" 
                      style={getWordStyle(word.count, i)}
                    >
                      {word.text}
                    </span>
                  ))}
                  {totalVotes === 0 && (
                    <div style={styles.emptyPrompt}>
                      <Cloud size={40} color="var(--text-dark-muted)" />
                      <p>Waiting for words to build cloud...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Type 3: Scales */}
              {activeSlide?.type === 'scales' && (
                <div style={styles.scalesWrapper}>
                  {scaleResults.map((res, i) => (
                    <div key={i} className="scale-slider-item">
                      <div className="scale-slider-label">
                        <span>{res.label}</span>
                        <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{res.average} / 5.0</span>
                      </div>
                      <div className="scale-slider-track">
                        <div 
                          className="scale-slider-fill"
                          style={{ width: `${res.percentage}%` }}
                        ></div>
                        <div 
                          className="scale-slider-value-indicator"
                          style={{ left: `${res.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  {totalVotes === 0 && (
                    <div style={styles.emptyPrompt}>
                      <Sliders size={40} color="var(--text-dark-muted)" />
                      <p>Waiting for evaluations...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Type 4: Open Ended */}
              {activeSlide?.type === 'open-ended' && (
                <div className="feedback-grid">
                  {activeSlide.submissions.map((sub, i) => (
                    <div key={i} className="feedback-card glass-panel">
                      <div style={styles.feedbackQuote}>&ldquo;</div>
                      <p style={{ position: 'relative', zIndex: 1 }}>{sub.value}</p>
                      <span style={styles.feedbackTime}>
                        {new Date(sub.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {totalVotes === 0 && (
                    <div style={styles.emptyPrompt}>
                      <MessageSquare size={40} color="var(--text-dark-muted)" />
                      <p>Waiting for feedback cards...</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="glass-panel" style={styles.hiddenResultsCard}>
              <EyeOff size={48} color="var(--text-dark-muted)" />
              <h2>Results are hidden</h2>
              <p>Press the show button below or 'H' to show responses to the class</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Control Toolbar */}
      <footer style={styles.controlToolbar}>
        <div style={styles.toolbarSection}>
          <button onClick={onExit} style={styles.toolbarBtn} title="Exit full screen">
            <X size={18} /> Exit
          </button>
        </div>

        <div style={{ ...styles.toolbarSection, gap: '16px' }}>
          <button 
            onClick={handlePrev} 
            style={styles.toolbarBtn} 
            disabled={activeIdx === 0}
            title="Previous Slide (ArrowLeft)"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span style={styles.slideCounter}>
            Slide {activeIdx + 1} of {presentation.slides.length}
          </span>

          <button 
            onClick={handleNext} 
            style={styles.toolbarBtn} 
            disabled={activeIdx === presentation.slides.length - 1}
            title="Next Slide (ArrowRight)"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div style={styles.toolbarSection}>
          <button 
            onClick={() => setShowResults(prev => !prev)} 
            style={{ ...styles.toolbarBtn, color: showResults ? 'var(--primary)' : 'var(--text-dark-secondary)' }}
            title="Toggle Results View (H)"
          >
            {showResults ? <Eye size={18} /> : <EyeOff size={18} />} Results
          </button>
          
          <button onClick={handleClearResults} style={styles.toolbarBtn} title="Clear Slide Results (C)">
            <Trash2 size={18} /> Reset
          </button>
        </div>
      </footer>

      {/* QR Code Popout Modal */}
      {showQR && (
        <div style={styles.modalBackdrop} onClick={() => setShowQR(false)}>
          <div className="glass-panel" style={styles.qrModal} onClick={e => e.stopPropagation()}>
            <div style={styles.qrHeader}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Scan to Join Session</h3>
              <button onClick={() => setShowQR(false)} style={styles.qrCloseBtn}>
                <X size={18} />
              </button>
            </div>
            
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${joinUrl}?code=${presentation.code}`)}`} 
              alt="QR Code to Join" 
              style={styles.qrImage}
            />
            
            <div style={styles.qrFooter}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dark-secondary)' }}>Or browse to:</span>
              <strong style={{ fontSize: '1rem', color: 'white', display: 'block', margin: '4px 0' }}>{joinUrl}</strong>
              <div style={styles.qrCodeBadge}>CODE: {presentation.code}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cinematic Style definitions
const styles = {
  fullscreenBg: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#04060c',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#04060c',
  },
  loadingPulse: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
    boxShadow: '0 0 30px var(--primary-glow)',
    animation: 'pulse-glow 1.5s infinite ease-in-out',
  },
  topBanner: {
    height: '80px',
    background: 'rgba(10, 15, 30, 0.9)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 32px',
    backdropFilter: 'blur(10px)',
  },
  bannerDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  bannerText: {
    fontSize: '1.25rem',
    color: 'var(--text-dark-secondary)',
  },
  bannerCodeCard: {
    display: 'flex',
    alignItems: 'center',
    background: '#0d1127',
    border: '2px solid rgba(99, 102, 241, 0.5)',
    borderRadius: '10px',
    padding: '6px 16px',
    gap: '12px',
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)',
  },
  bannerCodeLabel: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: 'var(--primary)',
    letterSpacing: '0.05em',
  },
  bannerCode: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.8rem',
    fontWeight: '800',
    letterSpacing: '0.1em',
    color: 'white',
  },
  bannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  topBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },
  reconnectingBadge: {
    fontSize: '0.8rem',
    color: 'var(--warning)',
  },
  slideDisplayArea: {
    flex: 1,
    padding: '60px 40px 100px 40px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflowY: 'auto',
  },
  slideContentWrapper: {
    width: '100%',
    maxWidth: '900px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '40px',
  },
  slideQuestion: {
    fontSize: '2.5rem',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: '1.3',
  },
  visualisationPanel: {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  mcWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },
  scalesWrapper: {
    width: '100%',
  },
  emptyPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: 'var(--text-dark-muted)',
    padding: '60px 0',
  },
  hiddenResultsCard: {
    padding: '60px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    textAlign: 'center',
  },
  feedbackQuote: {
    position: 'absolute',
    top: '-10px',
    left: '12px',
    fontSize: '4rem',
    fontFamily: 'serif',
    color: 'rgba(255, 255, 255, 0.05)',
    lineHeight: 1,
  },
  feedbackTime: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-dark-muted)',
    marginTop: '12px',
    textAlign: 'right',
  },
  controlToolbar: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(13, 17, 36, 0.85)',
    border: '1px solid var(--border-dark)',
    borderRadius: '100px',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
    boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
    backdropFilter: 'blur(16px)',
    zIndex: 1000,
    transition: 'opacity 0.3s ease',
  },
  toolbarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  toolbarBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dark-secondary)',
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.2s, background 0.2s',
  },
  slideCounter: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'white',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  qrModal: {
    width: '100%',
    maxWidth: '350px',
    padding: '24px',
    textAlign: 'center',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
  },
  qrHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  qrCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dark-muted)',
  },
  qrImage: {
    width: '200px',
    height: '200px',
    margin: '0 auto',
    borderRadius: '8px',
    background: 'white',
    padding: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  qrFooter: {
    marginTop: '20px',
  },
  qrCodeBadge: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--primary)',
    padding: '6px 12px',
    borderRadius: '100px',
    fontSize: '1.1rem',
    fontWeight: '800',
    letterSpacing: '0.05em',
    marginTop: '12px',
    display: 'inline-block',
  }
};

export default PresenterMode;
