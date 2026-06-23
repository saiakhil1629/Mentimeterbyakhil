const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_VERSION !== undefined || process.env.PORT === undefined;
const DB_FILE = isVercel
  ? path.join('/tmp', 'presentations.json')
  : path.join(__dirname, 'data', 'presentations.json');

// Ensure data folder exists (only locally, /tmp always exists on Vercel)
if (!isVercel && !fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

const defaultPresentations = [
  {
    id: "sample-presentation",
    title: "Class Feedback Survey",
    code: "123456",
    activeSlideIndex: 0,
    isActive: false,
    slides: [
      {
        id: "slide-1",
        type: "multiple-choice",
        question: "How would you rate your understanding of React Hooks?",
        options: [
          "Excellent - I use them daily",
          "Good - I understand the basics",
          "Fair - I need more practice",
          "Confused - What is a hook?"
        ],
        submissions: [] // Array of { voterId, value (index of option) }
      },
      {
        id: "slide-2",
        type: "word-cloud",
        question: "What words come to mind when you think of real-time WebSockets?",
        options: [],
        submissions: [] // Array of { voterId, value (string representing 1-3 words) }
      },
      {
        id: "slide-3",
        type: "scales",
        question: "Rate the following aspects of today's lesson:",
        options: [
          "Pace of learning",
          "Instructor clarity",
          "Material quality",
          "Interactive exercises"
        ],
        submissions: [] // Array of { voterId, value (array of numbers, e.g., [4, 5, 3, 4]) }
      },
      {
        id: "slide-4",
        type: "open-ended",
        question: "Do you have any additional questions or feedback for the instructor?",
        options: [],
        submissions: [] // Array of { voterId, value (string feedback) }
      }
    ]
  }
];

class Database {
  constructor() {
    this.presentations = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.presentations = JSON.parse(data);
      } else {
        this.presentations = defaultPresentations;
        this.save();
      }
    } catch (error) {
      console.error("Error loading presentations database, resetting to default:", error);
      this.presentations = defaultPresentations;
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.presentations, null, 2), 'utf8');
    } catch (error) {
      console.error("Error saving presentations database:", error);
    }
  }

  getAll() {
    return this.presentations;
  }

  getById(id) {
    return this.presentations.find(p => p.id === id);
  }

  getByCode(code) {
    // Join code is case-insensitive and whitespace stripped
    const cleanCode = String(code).replace(/\s/g, '');
    return this.presentations.find(p => p.code.replace(/\s/g, '') === cleanCode);
  }

  create(title) {
    // Generate a unique 6-digit join code
    let code;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.getByCode(code));

    const newPresentation = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      code,
      activeSlideIndex: 0,
      isActive: false,
      slides: [
        {
          id: Math.random().toString(36).substring(2, 9),
          type: "multiple-choice",
          question: "How is your day going?",
          options: ["Great!", "Good", "Okay", "Not so good"],
          submissions: []
        }
      ]
    };

    this.presentations.push(newPresentation);
    this.save();
    return newPresentation;
  }

  update(id, updatedData) {
    const idx = this.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.presentations[idx] = { ...this.presentations[idx], ...updatedData };
      this.save();
      return this.presentations[idx];
    }
    return null;
  }

  delete(id) {
    const idx = this.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
      const deleted = this.presentations.splice(idx, 1)[0];
      this.save();
      return deleted;
    }
    return null;
  }

  addVote(presentationId, slideId, voterId, value) {
    const presentation = this.getById(presentationId);
    if (!presentation) return null;

    const slide = presentation.slides.find(s => s.id === slideId);
    if (!slide) return null;

    // Check if voter already submitted for this slide. If so, overwrite (or append depending on logic - let's overwrite to allow correcting votes)
    const existingIndex = slide.submissions.findIndex(sub => sub.voterId === voterId);
    if (existingIndex !== -1) {
      slide.submissions[existingIndex].value = value;
    } else {
      slide.submissions.push({ voterId, value, timestamp: new Date().toISOString() });
    }

    this.save();
    return presentation;
  }

  clearVotes(presentationId, slideId) {
    const presentation = this.getById(presentationId);
    if (!presentation) return null;

    const slide = presentation.slides.find(s => s.id === slideId);
    if (!slide) return null;

    slide.submissions = [];
    this.save();
    return presentation;
  }
}

module.exports = new Database();
