const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// ===== PAGE MANAGEMENT =====
const pages = {
  context: document.getElementById("contextPage"),
  recording: document.getElementById("recordingPage"),
  options: document.getElementById("optionsPage"),
  conversation: document.getElementById("conversationPage")
};

function showPage(pageName) {
  Object.values(pages).forEach(p => p.classList.remove("active"));
  pages[pageName].classList.add("active");
}

// ===== STATE =====
let selectedContext = null;
let selectedContextLabel = "";
let conversationHistory = [];
let currentUserMessage = null;

// ===== CONTEXT SELECTION PAGE =====
const contextButtons = document.querySelectorAll(".context-btn");
const ttsToggle = document.getElementById("ttsToggle");
const bigToggle = document.getElementById("bigToggle");

contextButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    contextButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedContext = btn.dataset.context;
    selectedContextLabel = btn.querySelector(".context-label").textContent;
    
    // Move to recording page
    document.getElementById("contextDisplay").textContent = selectedContextLabel;
    document.getElementById("recordingStatus").textContent = "";
    document.getElementById("transcriptDisplay").textContent = "Say something...";
    document.getElementById("manualInput").value = "";
    
    showPage("recording");
    setTimeout(() => document.getElementById("manualInput").focus(), 300);
  });
});

bigToggle.addEventListener("change", () => {
  document.documentElement.classList.toggle("big", bigToggle.checked);
});

document.getElementById("backFromRecording").addEventListener("click", () => {
  showPage("context");
});

document.getElementById("backFromOptions").addEventListener("click", () => {
  showPage("recording");
});

document.getElementById("newConversation").addEventListener("click", () => {
  showPage("context");
  conversationHistory = [];
  document.getElementById("conversationChat").innerHTML = "";
  document.getElementById("conversationOptionsGrid").innerHTML = "";
});

// ===== RECORDING PAGE =====
const recordBtn = document.getElementById("recordBtn");
const recordingStatus = document.getElementById("recordingStatus");
const transcriptDisplay = document.getElementById("transcriptDisplay");
const manualInput = document.getElementById("manualInput");
const manualSendBtn = document.getElementById("manualSendBtn");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-GB";
  recognition.continuous = false;
  recognition.interimResults = true;

  let finalTranscript = "";

  recognition.onstart = () => {
    finalTranscript = "";
    isRecording = true;
    recordBtn.classList.add("recording");
    recordBtn.innerHTML = '<span class="record-icon">⏹</span><span class="record-text">Recording...</span>';
    recordingStatus.textContent = "Listening...";
    transcriptDisplay.textContent = "";
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + " ";
      } else {
        interim += transcript;
      }
    }
    transcriptDisplay.textContent = (finalTranscript + interim).trim();
  };

  recognition.onerror = (e) => {
    recordingStatus.textContent = `Error: ${e.error}. Try again.`;
    recordBtn.classList.remove("recording");
    recordBtn.innerHTML = '<span class="record-icon">🎤</span><span class="record-text">Press to Record</span>';
    isRecording = false;
  };

  recognition.onend = () => {
    isRecording = false;
    recordBtn.classList.remove("recording");
    recordBtn.innerHTML = '<span class="record-icon">🎤</span><span class="record-text">Press to Record</span>';
    
    const transcript = transcriptDisplay.textContent.trim();
    if (transcript && transcript !== "Say something...") {
      recordingStatus.textContent = "Processing...";
      manualInput.value = transcript;
      // Auto-send after recording stops
      setTimeout(() => sendMessage(transcript), 500);
    } else {
      recordingStatus.textContent = "";
    }
  };
} else {
  recordBtn.disabled = true;
  recordBtn.title = "Speech recognition not supported in this browser";
}

recordBtn.addEventListener("click", () => {
  if (!recognition) return;

  if (isRecording) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      recordingStatus.textContent = "Could not start microphone. Try again.";
    }
  }
});

manualSendBtn.addEventListener("click", () => {
  const text = manualInput.value.trim();
  if (text) {
    sendMessage(text);
  }
});

manualInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = manualInput.value.trim();
    if (text) {
      sendMessage(text);
    }
  }
});

// ===== SEND MESSAGE & GET OPTIONS =====
async function sendMessage(text) {
  currentUserMessage = text;
  manualInput.value = "";
  recordingStatus.textContent = "";
  
  // Show user message on options page
  document.getElementById("userMessageDisplay").textContent = `You said: "${text}"`;
  document.getElementById("optionsStatus").textContent = "Generating reply options...";
  document.getElementById("optionsGrid").innerHTML = "";
  
  showPage("options");

  try {
    const data = await fetchSuggestions(text);
    renderOptions(data.suggestions);
    document.getElementById("optionsStatus").textContent = "";
  } catch (e) {
    document.getElementById("optionsStatus").classList.add("error");
    document.getElementById("optionsStatus").textContent = `Error: ${e.message}`;
  }
}

async function fetchSuggestions(text) {
  const payload = {
    session_id: sessionId,
    last_text: text,
    context: selectedContext,
    mode: "default"
  };

  const res = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed to get suggestions: ${res.status}`);
  }

  return await res.json();
}

function renderOptions(items) {
  const grid = document.getElementById("optionsGrid");
  grid.innerHTML = "";

  items.forEach((suggestion, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = suggestion.text;
    btn.onclick = () => selectOption(suggestion, currentUserMessage);
    grid.appendChild(btn);
  });
}

async function selectOption(suggestion, userMessage) {
  // Log the choice
  try {
    await fetch(`${API_BASE}/log_choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        suggestion_id: suggestion.id,
        context: selectedContext,
        intent: suggestion.intent,
        text: suggestion.text
      })
    });
  } catch (e) {
    console.error("Failed to log choice:", e);
  }

  // Add to conversation history
  conversationHistory.push(
    { role: "user", text: userMessage },
    { role: "assistant", text: suggestion.text }
  );

  // Speak the response
  speakText(suggestion.text);

  // Move to conversation view
  showConversation();
}

async function selectCustomReply() {
  const text = document.getElementById("customReplyInput").value.trim();
  if (!text) return;

  const suggestion = {
    id: "custom",
    text: text,
    intent: "custom",
    score: 0
  };

  document.getElementById("customReplyInput").value = "";
  await selectOption(suggestion, currentUserMessage);
}

// ===== CONVERSATION PAGE =====
function showConversation() {
  document.getElementById("conversationContextDisplay").textContent = selectedContextLabel;
  updateConversationDisplay();
  showPage("conversation");
  
  // Set up recording in conversation
  setupConversationRecording();
}

function updateConversationDisplay() {
  const chatDiv = document.getElementById("conversationChat");
  chatDiv.innerHTML = "";

  conversationHistory.forEach(msg => {
    const div = document.createElement("div");
    div.className = `chat-message ${msg.role === "user" ? "user" : "assistant"}`;
    div.textContent = msg.text;
    chatDiv.appendChild(div);
  });

  chatDiv.scrollTop = chatDiv.scrollHeight;
}

const conversationInput = document.getElementById("conversationInput");
const conversationSendBtn = document.getElementById("conversationSendBtn");
const conversationRecordBtn = document.getElementById("conversationRecordBtn");

conversationSendBtn.addEventListener("click", () => {
  const text = conversationInput.value.trim();
  if (text) {
    conversationInput.value = "";
    getOptionsForConversation(text);
  }
});

conversationInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = conversationInput.value.trim();
    if (text) {
      conversationInput.value = "";
      getOptionsForConversation(text);
    }
  }
});

let conversationRecognition = null;
let isConversationRecording = false;

function setupConversationRecording() {
  if (!conversationRecognition && SpeechRecognition) {
    conversationRecognition = new SpeechRecognition();
    conversationRecognition.lang = "en-GB";
    conversationRecognition.continuous = false;
    conversationRecognition.interimResults = true;

    let finalTranscript = "";

    conversationRecognition.onstart = () => {
      finalTranscript = "";
      isConversationRecording = true;
      conversationRecordBtn.classList.add("recording");
    };

    conversationRecognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      conversationInput.value = (finalTranscript + interim).trim();
    };

    conversationRecognition.onerror = () => {
      conversationRecordBtn.classList.remove("recording");
      isConversationRecording = false;
    };

    conversationRecognition.onend = () => {
      conversationRecordBtn.classList.remove("recording");
      isConversationRecording = false;
      
      const text = conversationInput.value.trim();
      if (text) {
        conversationInput.value = "";
        getOptionsForConversation(text);
      }
    };
  }
}

conversationRecordBtn.addEventListener("click", () => {
  if (!conversationRecognition) return;
  
  if (isConversationRecording) {
    conversationRecognition.stop();
  } else {
    try {
      conversationRecognition.start();
    } catch (e) {
      console.error("Could not start mic:", e);
    }
  }
});

async function getOptionsForConversation(text) {
  conversationHistory.push({ role: "user", text });
  updateConversationDisplay();
  
  document.getElementById("conversationStatus").textContent = "Generating reply options...";
  document.getElementById("conversationOptionsGrid").innerHTML = "";

  try {
    const data = await fetchSuggestions(text);
    renderConversationOptions(data.suggestions);
    document.getElementById("conversationStatus").textContent = "";
  } catch (e) {
    document.getElementById("conversationStatus").classList.add("error");
    document.getElementById("conversationStatus").textContent = `Error: ${e.message}`;
  }
}

function renderConversationOptions(items) {
  const grid = document.getElementById("conversationOptionsGrid");
  grid.innerHTML = "";

  items.forEach((suggestion) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = suggestion.text;
    btn.onclick = () => selectConversationOption(suggestion);
    grid.appendChild(btn);
  });

  // Add custom reply option
  const customDiv = document.createElement("div");
  customDiv.className = "manual-reply-section";
  customDiv.innerHTML = `
    <p class="manual-label">Or send a custom reply:</p>
    <div class="input-group">
      <input id="conversationCustomInput" type="text" placeholder="Type your own reply..." class="manual-input" />
      <button id="conversationCustomSendBtn" class="send-btn">Send</button>
    </div>
  `;
  grid.appendChild(customDiv);

  document.getElementById("conversationCustomSendBtn").addEventListener("click", () => {
    const text = document.getElementById("conversationCustomInput").value.trim();
    if (text) {
      document.getElementById("conversationCustomInput").value = "";
      selectConversationOption({ text, id: "custom", intent: "custom", score: 0 });
    }
  });

  document.getElementById("conversationCustomInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const text = document.getElementById("conversationCustomInput").value.trim();
      if (text) {
        document.getElementById("conversationCustomInput").value = "";
        selectConversationOption({ text, id: "custom", intent: "custom", score: 0 });
      }
    }
  });
}

function selectConversationOption(suggestion) {
  conversationHistory.push({ role: "assistant", text: suggestion.text });
  updateConversationDisplay();
  
  speakText(suggestion.text);
  
  document.getElementById("conversationOptionsGrid").innerHTML = "";

  // Log choice
  fetch(`${API_BASE}/log_choice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      suggestion_id: suggestion.id,
      context: selectedContext,
      intent: suggestion.intent,
      text: suggestion.text
    })
  }).catch(e => console.error("Failed to log choice:", e));
}

// ===== TEXT-TO-SPEECH =====
function speakText(text) {
  if (!ttsToggle.checked) return;
  if (!("speechSynthesis" in window)) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ===== CUSTOM REPLY ON OPTIONS PAGE =====
document.getElementById("customReplySendBtn").addEventListener("click", selectCustomReply);
document.getElementById("customReplyInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    selectCustomReply();
  }
});

// ===== STARTUP CHECKS =====
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (!r.ok) throw new Error("health check failed");
  } catch (e) {
    console.error("Backend connection failed:", e);
    // Still show app, user will see errors when trying to send
  }
})();

// Start on context page
showPage("context");