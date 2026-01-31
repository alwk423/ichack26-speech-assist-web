const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// Predefined contexts
const CONTEXTS = [
  { emoji: '🏥', label: 'Medical', value: 'medical' },
  { emoji: '🍽️', label: 'Restaurant', value: 'restaurant' },
  { emoji: '🛒', label: 'Shopping', value: 'shopping' },
  { emoji: '💼', label: 'Work', value: 'work' },
  { emoji: '👨‍👩‍👧‍👦', label: 'Family', value: 'family' },
  { emoji: '🎓', label: 'School', value: 'school' }
];

// Generic phrases
const GENERIC_PHRASES = [
  "Yes", "No", "Maybe", "I don't know",
  "Can you repeat that?", "I need help", "Thank you", "Excuse me",
  "I understand", "Please wait", "I'm sorry", "One moment please",
  "I agree", "I disagree", "Could you speak slower?", "I'm ready"
];

// State
let selectedContext = null;
let isRecording = false;
let transcript = '';
let mediaRecorder = null;
let audioChunks = [];

// Elements
const homeScreen = document.getElementById('homeScreen');
const recordScreen = document.getElementById('recordScreen');
const speechScreen = document.getElementById('speechScreen');
const contextGrid = document.getElementById('contextGrid');
const customContext = document.getElementById('customContext');
const startBtn = document.getElementById('startBtn');
const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');
const recordEmoji = document.getElementById('recordEmoji');
const recordContext = document.getElementById('recordContext');
const speechContextLabel = document.getElementById('speechContextLabel');
const transcriptDisplay = document.getElementById('transcriptDisplay');
const genericButtons = document.getElementById('genericButtons');
const contextualButtons = document.getElementById('contextualButtons');
const refreshBtn = document.getElementById('refreshBtn');
const statusBar = document.getElementById('statusBar');
const recordingToggle = document.getElementById('recordingToggle');

// Initialize contexts
function initContexts() {
  CONTEXTS.forEach(ctx => {
    const card = document.createElement('div');
    card.className = 'context-card';
    card.innerHTML = `
      <div class="context-emoji">${ctx.emoji}</div>
      <div class="context-label">${ctx.label}</div>
    `;
    card.onclick = () => selectContext(ctx, card);
    contextGrid.appendChild(card);
  });
}

function selectContext(ctx, element) {
  document.querySelectorAll('.context-card').forEach(c => c.classList.remove('selected'));
  element.classList.add('selected');
  selectedContext = ctx;
  customContext.value = '';
  startBtn.disabled = false;
}

customContext.addEventListener('input', (e) => {
  if (e.target.value.trim()) {
    document.querySelectorAll('.context-card').forEach(c => c.classList.remove('selected'));
    selectedContext = { emoji: '🗣️', label: e.target.value.trim(), value: 'custom' };
    startBtn.disabled = false;
  } else if (!document.querySelector('.context-card.selected')) {
    startBtn.disabled = true;
  }
});

startBtn.addEventListener('click', () => {
  showScreen('record');
  recordEmoji.textContent = selectedContext.emoji;
  recordContext.textContent = selectedContext.label;
  speechContextLabel.textContent = selectedContext.label;
});

// Recording functionality
recordBtn.addEventListener('click', () => {
  showScreen('speech');
  initGenericButtons();

  if (!isRecording) {
    setTimeout(() => {
      toggleSpeechRecording();
    }, 100);
  }
});

async function transcribeAudio(audioBlob) {
  try {
    showStatus('Transcribing...', '');
    // Simulated transcription - in real app, send to backend
    const simulatedText = "This is simulated transcription text. ";
    transcript += simulatedText;
    transcriptDisplay.textContent = transcript;
    showStatus('Transcription complete', 'success');
  } catch (error) {
    showStatus('Transcription failed', 'error');
  }
}

// Recording toggle on speech screen
const recordingToggleElement = recordingToggle;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

recordingToggle.addEventListener('click', toggleSpeechRecording);

async function toggleSpeechRecording() {
  if (SpeechRecognition) {
    // Use Web Speech API when available (short utterances)
    if (!recognition) {
      recognition = new (SpeechRecognition)();
      recognition.lang = 'en-GB';
      recognition.continuous = true;
      recognition.interimResults = true;
      let finalTranscript = '';

      recognition.onstart = () => {
        isRecording = true;
        recordingToggle.classList.add('recording');
        recordingToggle.classList.remove('paused');
        recordingToggle.title = 'Pause Recording';
        showStatus('Recording conversation...', '');
      };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcriptPart + ' ';
          else interim += transcriptPart;
        }
        transcript = (finalTranscript + interim).trim();
        transcriptDisplay.textContent = transcript;
      };

      recognition.onerror = (e) => {
        showStatus('Speech recognition error', 'error');
      };

      recognition.onend = () => {
        isRecording = false;
        recordingToggle.classList.remove('recording');
        recordingToggle.classList.add('paused');
        recordingToggle.title = 'Start Recording';
        showStatus('Recording paused', '');
      };
    }

    if (!isRecording) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Could not start recognition', e);
      }
    } else {
      recognition.stop();
    }
    return;
  }

  // Fallback to MediaRecorder if Web Speech API is not available
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      recordingToggle.classList.add('recording');
      recordingToggle.classList.remove('paused');
      recordingToggle.title = 'Pause Recording';
      showStatus('Recording conversation...', '');
    } catch (error) {
      showStatus('Microphone access denied', 'error');
    }
  } else {
    mediaRecorder.stop();
    if (mediaRecorder.stream && mediaRecorder.stream.getTracks) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
    recordingToggle.classList.remove('recording');
    recordingToggle.classList.add('paused');
    recordingToggle.title = 'Start Recording';
    showStatus('Recording paused', '');
  }
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
  });
});

// Generic buttons
function initGenericButtons() {
  genericButtons.innerHTML = '';
  GENERIC_PHRASES.forEach(phrase => {
    const btn = document.createElement('button');
    btn.className = 'speech-btn';
    btn.textContent = phrase;
    btn.onclick = () => speakPhrase(phrase);
    genericButtons.appendChild(btn);
  });
}

// Contextual buttons refresh
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<span class="loading-spinner"></span><span>Loading...</span>';

  try {
    const suggestions = await fetchSuggestions();
    renderContextualButtons(suggestions);
    showStatus('Suggestions refreshed', 'success');
  } catch (error) {
    showStatus('Failed to fetch suggestions', 'error');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<span>🔄</span><span>Refresh</span>';
  }
});

async function fetchSuggestions() {
  const payload = {
    session_id: sessionId,
    last_text: transcript,
    context: selectedContext.value,
    mode: "contextual"
  };

  const res = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error('Suggest failed');
  const data = await res.json();
  return data.suggestions || [];
}

function renderContextualButtons(suggestions) {
  contextualButtons.innerHTML = '';
  suggestions.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'speech-btn';
    btn.textContent = s.text;
    btn.onclick = () => {
      speakPhrase(s.text);
      logChoice(s);
    };
    contextualButtons.appendChild(btn);
  });
}

async function logChoice(suggestion) {
  try {
    await fetch(`${API_BASE}/log_choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        suggestion_id: suggestion.id,
        context: selectedContext.value,
        intent: suggestion.intent,
        text: suggestion.text
      })
    });
  } catch (error) {
    console.error('Log choice failed:', error);
  }
}

function speakPhrase(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    transcript += text + ' ';
    transcriptDisplay.textContent = transcript;
  }
}

// Navigation
document.getElementById('backFromRecord').addEventListener('click', () => {
  showScreen('home');
});

document.getElementById('backFromSpeech').addEventListener('click', () => {
  if (isRecording) {
    toggleSpeechRecording();
  }
  showScreen('record');
});

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screen + 'Screen').classList.add('active');
}

function showStatus(message, type) {
  statusBar.textContent = message;
  statusBar.className = 'status-bar';
  if (type) statusBar.classList.add(type);
  statusBar.style.display = 'block';
  setTimeout(() => {
    statusBar.style.display = 'none';
  }, 3000);
}

// Health check
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (r.ok) {
      showStatus('Backend connected', 'success');
    }
  } catch (e) {
    showStatus('Backend not connected - some features may not work', 'error');
  }
})();

// Initialize
initContexts();