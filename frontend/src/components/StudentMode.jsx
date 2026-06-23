import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Send, Users, WifiOff } from 'lucide-react';
import { getWebSocketUrl, getApiUrl } from '../App';

function StudentMode({ joinCode, voterId, onExit }) {
  const [slide, setSlide] = useState(null);
  const [presentationTitle, setPresentationTitle] = useState('VibeVote Session');
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Track votes in localStorage so refreshes don't bypass voting limits
  const [votedSlides, setVotedSlides] = useState(() => {
    try {
      const stored = localStorage.getItem(`vibevote_voted_slides_${joinCode}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Vote state values depending on active slide type
  const [mcSelection, setMcSelection] = useState(null);
  const [wcInputs, setWcInputs] = useState(['', '', '']);
  const [scaleRatings, setScaleRatings] = useState({});
  const [openText, setOpenText] = useState('');

  const wsRef = useRef(null);

  // Set up WebSocket connection
  useEffect(() => {
    connectWS();
    fetchPresentationDetails();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [joinCode]);

  // Fetch presentation title
  const fetchPresentationDetails = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/presentations/code/${joinCode}`));
      if (res.ok) {
        const data = await res.json();
        setPresentationTitle(data.title);
      }
    } catch (err) {
      console.error("Error fetching presentation details:", err);
    }
  };

  const connectWS = () => {
    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Init as student
      ws.send(JSON.stringify({
        type: 'init',
        role: 'student',
        code: joinCode,
        voterId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'slide_update') {
          const newSlide = message.slide;
          setSlide(newSlide);
          
          // Reset voting input states when slide changes
          if (newSlide) {
            setMcSelection(null);
            setWcInputs(['', '', '']);
            setOpenText('');
            // Initialize scales ratings to 3 (neutral) for each option
            if (newSlide.type === 'scales' && newSlide.options) {
              const initialRatings = {};
              newSlide.options.forEach(opt => {
                initialRatings[opt] = 3;
              });
              setScaleRatings(initialRatings);
            }
          }
        } else if (message.type === 'vote_registered') {
          // Add to local voted list
          setVotedSlides(prev => {
            const updated = { ...prev, [message.slideId]: true };
            localStorage.setItem(`vibevote_voted_slides_${joinCode}`, JSON.stringify(updated));
            return updated;
          });
          setSubmitting(false);
        } else if (message.type === 'error') {
          alert(message.message);
          onExit();
        }
      } catch (err) {
        console.error("Error parsing websocket message:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Retry in 3s
      setTimeout(connectWS, 3000);
    };
  };

  const handleSubmitVote = (e) => {
    if (e) e.preventDefault();
    if (!slide || !connected || submitting) return;

    let voteValue = null;

    if (slide.type === 'multiple-choice') {
      if (mcSelection === null) return;
      voteValue = mcSelection;
    } else if (slide.type === 'word-cloud') {
      // Filter out empty words, and join them by space or commas
      const words = wcInputs.map(w => w.trim()).filter(w => w.length > 0);
      if (words.length === 0) return;
      voteValue = words.join(', ');
    } else if (slide.type === 'scales') {
      // Convert ratings map into array matching option indices
      voteValue = slide.options.map(opt => scaleRatings[opt] ?? 3);
    } else if (slide.type === 'open-ended') {
      if (!openText.trim()) return;
      voteValue = openText.trim();
    }

    if (voteValue === null) return;

    setSubmitting(true);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'vote',
        slideId: slide.id,
        voterId,
        value: voteValue
      }));
    }
  };

  const hasVotedCurrentSlide = slide && votedSlides[slide.id];

  // Render voter states
  return (
    <div style={styles.mobileContainer}>
      
      {/* Mobile Top Header */}
      <header style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <span style={styles.codeIndicator}>Code: {joinCode}</span>
          <h2 style={styles.presentationTitle}>{presentationTitle}</h2>
        </div>
        <button onClick={onExit} style={styles.closeBtn} title="Leave Session">
          <X size={20} />
        </button>
      </header>

      {/* Connection warning bar */}
      {!connected && (
        <div style={styles.offlineBar}>
          <WifiOff size={14} /> Reconnecting to slide server...
        </div>
      )}

      {/* Main interactive area */}
      <div style={styles.body}>
        
        {/* State 1: Connecting / Fetching state */}
        {!slide && (
          <div style={styles.centerMessage}>
            <div style={styles.loader}></div>
            <h3 style={{ marginTop: '24px', fontWeight: 'bold' }}>Waiting for Presenter</h3>
            <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
              The presentation hasn't started or no slides are active.
            </p>
          </div>
        )}

        {/* State 2: Already Voted / Wait screen */}
        {slide && hasVotedCurrentSlide && (
          <div style={styles.centerMessage}>
            <div className="glass-panel animate-scale-in" style={styles.successCard}>
              <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Response Submitted!</h3>
              <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.85rem', marginTop: '8px', lineHeight: '1.5' }}>
                Thank you for your response. Hang tight! Your answers are updating on the presenter screen.
              </p>
            </div>
            <p style={{ color: 'var(--text-dark-muted)', fontSize: '0.8rem', marginTop: '24px' }}>
              Waiting for the next slide...
            </p>
          </div>
        )}

        {/* State 3: Active Voting Forms */}
        {slide && !hasVotedCurrentSlide && (
          <div className="animate-slide-up" style={{ width: '100%' }}>
            
            <h1 style={styles.questionTitle}>{slide.question}</h1>

            <form onSubmit={handleSubmitVote} style={styles.form}>
              
              {/* Type 1: Multiple Choice Form */}
              {slide.type === 'multiple-choice' && (
                <div style={styles.optionsWrapper}>
                  {slide.options.map((opt, idx) => (
                    <div 
                      key={idx}
                      className="glass-panel"
                      style={{
                        ...styles.optionCard,
                        borderColor: mcSelection === idx ? 'var(--primary)' : 'var(--border-dark)',
                        background: mcSelection === idx ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)'
                      }}
                      onClick={() => setMcSelection(idx)}
                    >
                      <div style={{
                        ...styles.radioCircle,
                        borderColor: mcSelection === idx ? 'var(--primary)' : 'var(--text-dark-muted)',
                        background: mcSelection === idx ? 'var(--primary)' : 'transparent'
                      }}>
                        {mcSelection === idx && <div style={styles.radioInner}></div>}
                      </div>
                      <span style={{ fontWeight: '500', color: 'white' }}>{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Type 2: Word Cloud Form */}
              {slide.type === 'word-cloud' && (
                <div style={styles.wcWrapper}>
                  <p style={styles.inputInstruction}>Enter up to 3 words (one per box):</p>
                  {wcInputs.map((val, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`Word ${idx + 1}`}
                      value={val}
                      onChange={(e) => {
                        const updated = [...wcInputs];
                        updated[idx] = e.target.value.substring(0, 20); // max 20 chars per word
                        setWcInputs(updated);
                      }}
                      className="input-field"
                      style={{ marginBottom: '12px' }}
                    />
                  ))}
                </div>
              )}

              {/* Type 3: Scales Form */}
              {slide.type === 'scales' && (
                <div style={styles.scalesWrapper}>
                  {slide.options.map((opt, idx) => (
                    <div key={idx} style={styles.scaleItem}>
                      <div style={styles.scaleHeader}>
                        <span style={styles.scaleLabel}>{opt}</span>
                        <span style={styles.scaleValue}>{scaleRatings[opt] ?? 3} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scaleRatings[opt] ?? 3}
                        onChange={(e) => {
                          setScaleRatings(prev => ({
                            ...prev,
                            [opt]: parseInt(e.target.value)
                          }));
                        }}
                        style={styles.scaleSlider}
                      />
                      <div style={styles.sliderTicks}>
                        <span>Strongly Disagree</span>
                        <span>Strongly Agree</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Type 4: Open Ended Form */}
              {slide.type === 'open-ended' && (
                <div style={styles.openWrapper}>
                  <textarea
                    placeholder="Type your feedback, question, or message..."
                    value={openText}
                    onChange={(e) => setOpenText(e.target.value.substring(0, 250))}
                    className="input-field"
                    style={styles.textarea}
                    rows={5}
                    required
                  />
                  <div style={styles.charCounter}>
                    {openText.length} / 250 characters
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary"
                style={styles.submitBtn}
                disabled={
                  submitting || 
                  (slide.type === 'multiple-choice' && mcSelection === null) ||
                  (slide.type === 'word-cloud' && wcInputs.every(w => w.trim() === '')) ||
                  (slide.type === 'open-ended' && !openText.trim())
                }
              >
                <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Response'}
              </button>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}

// Mobile Voter Styles
const styles = {
  mobileContainer: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#070913',
    borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  },
  header: {
    height: '64px',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-dark)',
    background: 'rgba(13, 17, 36, 0.8)',
    backdropFilter: 'blur(8px)',
  },
  headerTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  codeIndicator: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    letterSpacing: '0.05em',
  },
  presentationTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '280px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dark-secondary)',
    cursor: 'pointer',
    padding: '6px',
  },
  offlineBar: {
    background: 'var(--warning)',
    color: 'black',
    fontSize: '0.8rem',
    fontWeight: '600',
    textAlign: 'center',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  body: {
    flex: 1,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'auto',
  },
  centerMessage: {
    textAlign: 'center',
    marginTop: '60px',
    width: '100%',
  },
  loader: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(99, 102, 241, 0.1)',
    borderTop: '4px solid var(--primary)',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite',
  },
  successCard: {
    padding: '32px 24px',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-md)',
  },
  questionTitle: {
    fontSize: '1.4rem',
    fontWeight: '700',
    lineHeight: '1.4',
    textAlign: 'center',
    marginBottom: '24px',
    color: 'white',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  optionsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  optionCard: {
    padding: '16px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  radioCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)',
  },
  radioInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'white',
  },
  inputInstruction: {
    fontSize: '0.85rem',
    color: 'var(--text-dark-secondary)',
    marginBottom: '10px',
  },
  wcWrapper: {
    width: '100%',
  },
  scalesWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  scaleItem: {
    width: '100%',
  },
  scaleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-dark-secondary)',
    marginBottom: '8px',
  },
  scaleLabel: {
    color: 'white',
  },
  scaleValue: {
    color: 'var(--secondary)',
  },
  scaleSlider: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '100px',
    outline: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none',
    marginBottom: '6px',
  },
  sliderTicks: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
    color: 'var(--text-dark-muted)',
  },
  openWrapper: {
    width: '100%',
  },
  textarea: {
    resize: 'none',
    lineHeight: '1.5',
    fontSize: '0.95rem',
  },
  charCounter: {
    textAlign: 'right',
    fontSize: '0.75rem',
    color: 'var(--text-dark-muted)',
    marginTop: '6px',
  },
  submitBtn: {
    width: '100%',
    height: '52px',
    fontSize: '1rem',
    borderRadius: '12px',
  }
};

export default StudentMode;
