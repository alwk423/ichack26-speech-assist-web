const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

const chat = document.getElementById("chat");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");

const suggestionsDiv = document.getElementById("suggestions");
const statusDiv = document.getElementById("status");
const contextSel = document.getElementById("context");
const ttsToggle = document.getElementById("ttsToggle");
const bigToggle = document.getElementById("bigToggle");

const manualReplyInput = document.getElementById("manualReplyInput");
const manualReplySendBtn = document.getElementById("manualReplySendBtn");

bigToggle.addEventListener("change", () => {
  document.documentElement.classList.toggle("big", bigToggle.checked);
});

function addMsg(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function setStatus(s) {
  statusDiv.textContent = s || "";
}

function speak(text) {
  if (!ttsToggle.checked) return;
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function fetchSuggestions(lastText) {
  const payload = {
    session_id: sessionId,
    last_text: lastText,
    context: contextSel.value,
    mode: "default"
  };

  const res = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`suggest failed: ${res.status} ${t}`);
  }

  return await res.json();
}

async function logChoice(s) {
  const payload = {
    session_id: sessionId,
    suggestion_id: s.id,
    context: contextSel.value,
    intent: s.intent,
    text: s.text
  };

  await fetch(`${API_BASE}/log_choice`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
}

function renderSuggestions(items) {
  suggestionsDiv.innerHTML = "";
  items.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s.text;
    btn.onclick = async () => {
      addMsg(s.text, "them");
      suggestionsDiv.innerHTML = "";
      speak(s.text);
      try { await logChoice(s); } catch(e) { /* ignore */ }
    };
    suggestionsDiv.appendChild(btn);
  });
}

async function send() {
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = "";

  addMsg(text, "me");
  setStatus("Generating reply options…");
  suggestionsDiv.innerHTML = "";

  try {
    const data = await fetchSuggestions(text);
    renderSuggestions(data.suggestions);
    setStatus("");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
}

async function sendManualReply() {
  const text = manualReplyInput.value.trim();
  if (!text) return;
  manualReplyInput.value = "";

  addMsg(text, "them");
  suggestionsDiv.innerHTML = "";
  speak(text);

  // Optional: log manual replies too (so system can learn them)
  try {
    await fetch(`${API_BASE}/log_choice`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        session_id: sessionId,
        suggestion_id: "manual",
        context: contextSel.value,
        intent: "manual",
        text: text
      })
    });
  } catch (e) {
    // ignore logging errors
  }
}

sendBtn.addEventListener("click", send);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

manualReplySendBtn.addEventListener("click", sendManualReply);
manualReplyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendManualReply();
});

// ---------- Voice input (English) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

function setMicListening(on) {
  isListening = on;
  micBtn.classList.toggle("listening", on);
  micBtn.textContent = on ? "⏹" : "🎤";
  setStatus(on ? "Listening… speak in English" : "");
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-GB";       // change to "en-US" if you want
  recognition.continuous = false;   // one utterance
  recognition.interimResults = true;

  let finalTranscript = "";

  recognition.onstart = () => {
    finalTranscript = "";
    setMicListening(true);
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interim += transcript;
    }
    msgInput.value = (finalTranscript + " " + interim).trim();
  };

  recognition.onerror = (e) => {
    setMicListening(false);
    setStatus(`Mic error: ${e.error}`);
  };

  recognition.onend = () => {
    setMicListening(false);
    // Optional: auto-send when finished talking
    // Uncomment the next line if you want it to auto-send:
    // if (msgInput.value.trim()) send();
  };
} else {
  micBtn.disabled = true;
  micBtn.title = "Speech recognition not supported in this browser";
}

micBtn.addEventListener("click", () => {
  if (!recognition) return;

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
  } catch (e) {
    setStatus("Could not start microphone. Try again.");
  }
});

// Startup check
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (!r.ok) throw new Error("health failed");
    setStatus("Backend connected.");
    setTimeout(() => setStatus(""), 1200);
  } catch (e) {
    setStatus("Cannot reach backend. Is it running on 127.0.0.1:8000 ?");
  }
})();
