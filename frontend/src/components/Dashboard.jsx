import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash, Play, ArrowLeft, BarChart2, Cloud, Sliders, MessageSquare, 
  Settings, RefreshCw, Check, AlertCircle, Edit2 
} from 'lucide-react';

function Dashboard({ onStartPresentation, onBackToHome }) {
  const [presentations, setPresentations] = useState([]);
  const [selectedPres, setSelectedPres] = useState(null);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Fetch all presentations on load
  useEffect(() => {
    fetchPresentations();
  }, []);

  const fetchPresentations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/presentations');
      if (res.ok) {
        const data = await res.json();
        setPresentations(data);
      }
    } catch (err) {
      console.error("Error fetching presentations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePresentation = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (res.ok) {
        const newPres = await res.json();
        setPresentations([...presentations, newPres]);
        setNewTitle('');
        // Open the newly created presentation
        handleSelectPresentation(newPres);
      }
    } catch (err) {
      console.error("Error creating presentation:", err);
    }
  };

  const handleDeletePresentation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this presentation?")) return;

    try {
      const res = await fetch(`/api/presentations/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setPresentations(presentations.filter(p => p.id !== id));
        if (selectedPres && selectedPres.id === id) {
          setSelectedPres(null);
        }
      }
    } catch (err) {
      console.error("Error deleting presentation:", err);
    }
  };

  const handleSelectPresentation = (pres) => {
    setSelectedPres(pres);
    setActiveSlideIdx(0);
    setTempTitle(pres.title);
    setEditingTitle(false);
  };

  // Save current selected presentation state back to backend
  const savePresentationState = async (updatedPres) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/presentations/${updatedPres.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPres)
      });
      if (res.ok) {
        setSaveStatus('saved');
        // Update local list
        setPresentations(presentations.map(p => p.id === updatedPres.id ? updatedPres : p));
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error("Error saving presentation:", err);
      setSaveStatus('error');
    }
  };

  // Trigger auto-save when presentation structure changes
  const updatePresentation = (fields) => {
    const updated = { ...selectedPres, ...fields };
    setSelectedPres(updated);
    savePresentationState(updated);
  };

  // Slide CRUD Actions
  const handleAddSlide = (type) => {
    const defaultQuestions = {
      'multiple-choice': "Choose your favorite option:",
      'word-cloud': "Enter your thoughts:",
      'scales': "Rate the items:",
      'open-ended': "Enter your feedback:"
    };

    const newSlide = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      question: defaultQuestions[type] || "New Slide Question",
      options: type === 'multiple-choice' ? ["Option A", "Option B"] : type === 'scales' ? ["Parameter 1"] : [],
      submissions: []
    };

    const updatedSlides = [...selectedPres.slides, newSlide];
    updatePresentation({ slides: updatedSlides });
    setActiveSlideIdx(updatedSlides.length - 1);
  };

  const handleDeleteSlide = (idx, e) => {
    e.stopPropagation();
    if (selectedPres.slides.length <= 1) {
      alert("A presentation must have at least one slide.");
      return;
    }

    const updatedSlides = selectedPres.slides.filter((_, i) => i !== idx);
    let nextActive = activeSlideIdx;
    if (activeSlideIdx >= updatedSlides.length) {
      nextActive = updatedSlides.length - 1;
    }
    setActiveSlideIdx(nextActive);
    updatePresentation({ slides: updatedSlides });
  };

  const handleUpdateSlideQuestion = (val) => {
    const updatedSlides = [...selectedPres.slides];
    updatedSlides[activeSlideIdx].question = val;
    updatePresentation({ slides: updatedSlides });
  };

  // Option actions for Multiple Choice / Scales
  const handleAddOption = () => {
    const updatedSlides = [...selectedPres.slides];
    const slide = updatedSlides[activeSlideIdx];
    slide.options.push(`New Option ${slide.options.length + 1}`);
    updatePresentation({ slides: updatedSlides });
  };

  const handleUpdateOption = (optIdx, val) => {
    const updatedSlides = [...selectedPres.slides];
    updatedSlides[activeSlideIdx].options[optIdx] = val;
    updatePresentation({ slides: updatedSlides });
  };

  const handleDeleteOption = (optIdx) => {
    const updatedSlides = [...selectedPres.slides];
    const slide = updatedSlides[activeSlideIdx];
    if (slide.options.length <= 1) return;
    slide.options = slide.options.filter((_, i) => i !== optIdx);
    updatePresentation({ slides: updatedSlides });
  };

  const handleSaveTitle = () => {
    if (!tempTitle.trim()) return;
    updatePresentation({ title: tempTitle.trim() });
    setEditingTitle(false);
  };

  const getSlideIcon = (type) => {
    switch (type) {
      case 'multiple-choice': return <BarChart2 size={16} />;
      case 'word-cloud': return <Cloud size={16} />;
      case 'scales': return <Sliders size={16} />;
      case 'open-ended': return <MessageSquare size={16} />;
      default: return null;
    }
  };

  const getSlideLabel = (type) => {
    switch (type) {
      case 'multiple-choice': return 'Multiple Choice';
      case 'word-cloud': return 'Word Cloud';
      case 'scales': return 'Scales';
      case 'open-ended': return 'Open Ended';
      default: return 'Slide';
    }
  };

  const activeSlide = selectedPres?.slides[activeSlideIdx];

  // --- Render Presenter Dashboard lists ---
  if (!selectedPres) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={onBackToHome} className="btn-secondary" style={styles.backBtn}>
            <ArrowLeft size={16} /> Home
          </button>
          <h1 style={styles.dashboardTitle}>Presenter Portal</h1>
        </div>

        <div style={styles.mainGrid}>
          {/* New presentation creator */}
          <div className="glass-panel" style={styles.createCard}>
            <h2 style={styles.sectionTitle}>Create New Presentation</h2>
            <form onSubmit={handleCreatePresentation} style={styles.createForm}>
              <input
                type="text"
                placeholder="e.g. Science Class Poll"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="input-field"
                style={{ marginBottom: '16px' }}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={!newTitle.trim()}>
                <Plus size={18} /> Create Presentation
              </button>
            </form>
          </div>

          {/* List of presentations */}
          <div style={{ flex: 2 }}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: '16px' }}>Your Presentations</h2>
            {loading ? (
              <div style={styles.loadingState}>
                <RefreshCw size={24} className="animate-spin" /> Loading presentations...
              </div>
            ) : presentations.length === 0 ? (
              <div className="glass-panel" style={styles.emptyState}>
                <AlertCircle size={32} color="var(--text-dark-muted)" />
                <p>No presentations created yet. Make your first one above!</p>
              </div>
            ) : (
              <div style={styles.presList}>
                {presentations.map((pres) => (
                  <div 
                    key={pres.id} 
                    className="glass-panel" 
                    style={styles.presCard}
                    onClick={() => handleSelectPresentation(pres)}
                  >
                    <div style={styles.presInfo}>
                      <h3 style={styles.presTitle}>{pres.title}</h3>
                      <div style={styles.presMeta}>
                        <span>Code: <strong>{pres.code}</strong></span>
                        <span>•</span>
                        <span>{pres.slides.length} slides</span>
                      </div>
                    </div>
                    <div style={styles.presActions}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onStartPresentation(pres.id); }} 
                        className="btn-primary" 
                        style={styles.presPlayBtn}
                      >
                        <Play size={16} fill="white" /> Present
                      </button>
                      <button 
                        onClick={(e) => handleDeletePresentation(pres.id, e)} 
                        className="btn-danger" 
                        style={styles.presTrashBtn}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Render presentation Slide Editor ---
  return (
    <div style={styles.editorContainer}>
      {/* Editor Header */}
      <header style={styles.editorHeader}>
        <div style={styles.editorLeftHeader}>
          <button onClick={() => { setSelectedPres(null); fetchPresentations(); }} className="btn-secondary" style={styles.backBtn}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          
          <div style={styles.titleEditContainer}>
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={tempTitle} 
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="input-field"
                  style={{ padding: '6px 12px', fontSize: '1.2rem', width: '250px' }}
                />
                <button onClick={handleSaveTitle} className="btn-primary" style={{ padding: '8px 12px' }}>
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <h2 style={styles.presentationHeaderTitle}>{selectedPres.title}</h2>
                <button onClick={() => setEditingTitle(true)} style={styles.iconBtn}>
                  <Edit2 size={14} color="var(--text-dark-secondary)" />
                </button>
              </div>
            )}
            <span style={styles.codeBadge}>JOIN CODE: {selectedPres.code}</span>
          </div>
        </div>

        <div style={styles.editorRightHeader}>
          {/* Autosave status indicator */}
          <div style={styles.saveIndicator}>
            {saveStatus === 'saving' && <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={14} className="animate-spin" /> Saving...</span>}
            {saveStatus === 'saved' && <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} /> Saved</span>}
            {saveStatus === 'error' && <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={14} /> Save error</span>}
          </div>

          <button onClick={() => onStartPresentation(selectedPres.id)} className="btn-primary" style={{ padding: '10px 20px' }}>
            <Play size={16} fill="white" /> Start Presenting
          </button>
        </div>
      </header>

      {/* Editor Split Panel */}
      <div style={styles.editorGrid}>
        
        {/* Left Side: Slides List */}
        <div style={styles.slideListPanel}>
          <div style={styles.panelTitleContainer}>
            <span style={styles.panelTitle}>Slides ({selectedPres.slides.length})</span>
          </div>

          <div style={styles.slideThumbnailsContainer}>
            {selectedPres.slides.map((slide, idx) => (
              <div 
                key={slide.id} 
                className={`glass-panel ${activeSlideIdx === idx ? 'active-slide' : ''}`}
                style={{
                  ...styles.slideThumb,
                  borderColor: activeSlideIdx === idx ? 'var(--primary)' : 'var(--border-dark)',
                  background: activeSlideIdx === idx ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-dark-surface)'
                }}
                onClick={() => setActiveSlideIdx(idx)}
              >
                <div style={styles.thumbHeader}>
                  <span style={styles.thumbIndex}>{idx + 1}</span>
                  <div style={styles.thumbIcon}>
                    {getSlideIcon(slide.type)}
                  </div>
                </div>
                <div style={styles.thumbQuestion}>
                  {slide.question || "Empty question..."}
                </div>
                <button 
                  onClick={(e) => handleDeleteSlide(idx, e)} 
                  style={styles.thumbTrash}
                  title="Delete slide"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Slide Toolbar */}
          <div style={styles.addSlidePanel}>
            <span style={styles.addSlideLabel}>Add Slide:</span>
            <div style={styles.addButtonsGrid}>
              <button onClick={() => handleAddSlide('multiple-choice')} style={styles.addBtn} title="Multiple Choice">
                <BarChart2 size={16} /> MC
              </button>
              <button onClick={() => handleAddSlide('word-cloud')} style={styles.addBtn} title="Word Cloud">
                <Cloud size={16} /> WC
              </button>
              <button onClick={() => handleAddSlide('scales')} style={styles.addBtn} title="Slider Scales">
                <Sliders size={16} /> Scale
              </button>
              <button onClick={() => handleAddSlide('open-ended')} style={styles.addBtn} title="Open Feedback">
                <MessageSquare size={16} /> Open
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Slide Settings Editor */}
        <div className="glass-panel" style={styles.slideEditPanel}>
          {activeSlide ? (
            <div style={styles.editContent}>
              <div style={styles.editHeader}>
                <span style={styles.editSlideTypeBadge}>
                  {getSlideIcon(activeSlide.type)} {getSlideLabel(activeSlide.type)}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>Slide ID: {activeSlide.id}</span>
              </div>

              {/* Question Text Box */}
              <div style={styles.editSection}>
                <label style={styles.editLabel}>Question / Prompt</label>
                <input 
                  type="text" 
                  value={activeSlide.question}
                  onChange={(e) => handleUpdateSlideQuestion(e.target.value)}
                  className="input-field"
                  placeholder="Enter the slide question here"
                />
              </div>

              {/* Dynamic options editor depending on slide type */}
              {(activeSlide.type === 'multiple-choice' || activeSlide.type === 'scales') && (
                <div style={styles.editSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={styles.editLabel}>
                      {activeSlide.type === 'multiple-choice' ? 'Poll Options' : 'Rating Dimensions'}
                    </label>
                    <button onClick={handleAddOption} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  
                  <div style={styles.optionsList}>
                    {activeSlide.options.map((opt, optIdx) => (
                      <div key={optIdx} style={styles.optionInputRow}>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                          className="input-field"
                          style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                        />
                        <button 
                          onClick={() => handleDeleteOption(optIdx)} 
                          style={styles.optionDeleteBtn}
                          disabled={activeSlide.options.length <= 1}
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Word Cloud or Open Ended Instructions */}
              {activeSlide.type === 'word-cloud' && (
                <div className="glass-panel" style={styles.instructionBanner}>
                  <strong>Word Cloud Info:</strong> Students will have text inputs to submit up to 3 words. Resulting words will assemble in a live visual cluster on the presenter's screen.
                </div>
              )}

              {activeSlide.type === 'open-ended' && (
                <div className="glass-panel" style={styles.instructionBanner}>
                  <strong>Open-Ended Feedback:</strong> Students will be given a larger textarea to submit open questions or custom notes. Responses will populate in real-time as scrollable grid cards.
                </div>
              )}
            </div>
          ) : (
            <div style={styles.noSlideSelected}>
              <AlertCircle size={40} color="var(--text-dark-muted)" />
              <p>Select or create a slide to begin editing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styling definitions
const styles = {
  container: {
    width: '100%',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '40px',
  },
  backBtn: {
    padding: '8px 16px',
    fontSize: '0.9rem',
  },
  dashboardTitle: {
    fontSize: '2rem',
    fontWeight: '700',
  },
  mainGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: '32px',
    flexWrap: 'wrap',
  },
  createCard: {
    flex: 1,
    minWidth: '300px',
    padding: '32px',
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '20px',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--text-dark-secondary)',
    padding: '40px 0',
  },
  emptyState: {
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--text-dark-muted)',
    textAlign: 'center',
  },
  presList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  presCard: {
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  presInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  presTitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
  },
  presMeta: {
    display: 'flex',
    gap: '10px',
    fontSize: '0.85rem',
    color: 'var(--text-dark-secondary)',
  },
  presActions: {
    display: 'flex',
    gap: '12px',
  },
  presPlayBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  presTrashBtn: {
    padding: '8px 12px',
  },

  // Slide Editor Styling
  editorContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
  },
  editorHeader: {
    height: '70px',
    borderBottom: '1px solid var(--border-dark)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    background: 'rgba(7, 9, 19, 0.8)',
    backdropFilter: 'blur(10px)',
    flexShrink: 0,
  },
  editorLeftHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  titleEditContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  presentationHeaderTitle: {
    fontSize: '1.3rem',
    fontWeight: '700',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBadge: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--primary)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
  },
  editorRightHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  saveIndicator: {
    fontSize: '0.85rem',
  },
  editorGrid: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  slideListPanel: {
    width: '280px',
    borderRight: '1px solid var(--border-dark)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    background: 'rgba(13, 17, 36, 0.3)',
  },
  panelTitleContainer: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-dark)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-dark-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  slideThumbnailsContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  slideThumb: {
    padding: '14px',
    borderRadius: '10px',
    cursor: 'pointer',
    position: 'relative',
    height: '90px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all var(--transition-fast)',
  },
  thumbHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thumbIndex: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-dark-muted)',
  },
  thumbIcon: {
    color: 'var(--text-dark-secondary)',
    opacity: 0.8,
  },
  thumbQuestion: {
    fontSize: '0.85rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '6px',
    color: 'var(--text-dark-primary)',
  },
  thumbTrash: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dark-muted)',
    opacity: 0.5,
    transition: 'opacity var(--transition-fast), color var(--transition-fast)',
  },
  addSlidePanel: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border-dark)',
    background: 'rgba(7, 9, 19, 0.4)',
  },
  addSlideLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-dark-muted)',
    display: 'block',
    marginBottom: '10px',
  },
  addButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  addBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-dark)',
    borderRadius: '8px',
    padding: '8px 4px',
    color: 'white',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    fontWeight: '500',
    transition: 'background var(--transition-fast)',
  },
  slideEditPanel: {
    flex: 1,
    margin: '24px',
    borderRadius: '16px',
    padding: '32px',
    overflowY: 'auto',
  },
  editContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  editHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-dark)',
    paddingBottom: '16px',
  },
  editSlideTypeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  editSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editLabel: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-dark-secondary)',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionInputRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  optionDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dark-muted)',
    cursor: 'pointer',
    padding: '8px',
    transition: 'color var(--transition-fast)',
  },
  instructionBanner: {
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    color: 'var(--text-dark-secondary)',
  },
  noSlideSelected: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-dark-muted)',
    gap: '16px',
  }
};

export default Dashboard;
