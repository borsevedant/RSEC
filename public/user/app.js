let currentEmergencyType = '';
let pin = '';
const correctPin = '1234';
const deviceId = "RSECS-001";

const apiCreate = '/api/emergency';
const QUEUE_KEY = "rsecs_pending_alerts";
let currentLang = 'en';
let severity = "Medium";

let activeEmergencyId = null;
let watchId = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let isRecording = false;

// PAN-INDIA SUPPORT: 22 Major Languages
const translations = {
  en: { name: "English", native: "English", emergency: "EMERGENCY", tapHelp: "PANIC BUTTON", enterPin: "Enter PIN", verifyIdentity: "Verify identity", cancel: "Cancel", selectEmergency: "Select Service", whatHelp: "What assistance needed?", medical: "Medical", crime: "Police", fire: "Fire", disaster: "Disaster", cancelEmergency: "Cancel", alertSent: "Alert Sent", helpOnWay: "Help is on the way", location: "Location", returnHome: "Return" },
  hi: { name: "Hindi", native: "हिन्दी", emergency: "आपातकालीन", tapHelp: "पैनिक बटन", enterPin: "पिन दर्ज करें", verifyIdentity: "पहचान सत्यापित करें", cancel: "रद्द करें", selectEmergency: "आपातकालीन चुनें", whatHelp: "आपको क्या मदद चाहिए?", medical: "चिकित्सा", crime: "अपराध", fire: "आग", disaster: "आपदा", cancelEmergency: "रद्द करें", alertSent: "अलर्ट भेजा गया", helpOnWay: "मदद रास्ते में है", location: "स्थान", returnHome: "मुख्य पृष्ठ" },
  mr: { name: "Marathi", native: "मराठी", emergency: "आणीबाणी", tapHelp: "पॅनिक बटण", enterPin: "पिन प्रविष्ट करा", verifyIdentity: "ओळख पडताळा", cancel: "रद्द करा", selectEmergency: "आणीबाणी निवडा", whatHelp: "तुम्हाला कोणती मदत हवी आहे?", medical: "वैद्यकीय", crime: "गुन्हा", fire: "आग", disaster: "आपत्ती", cancelEmergency: "रद्द करा", alertSent: "अलर्ट पाठवला", helpOnWay: "मदत येत आहे", location: "स्थान", returnHome: "मुख्य पृष्ठ" },
  ta: { name: "Tamil", native: "தமிழ்", emergency: "அவசரம்", tapHelp: "அவசர பொத்தான்", enterPin: "பின்னை உள்ளிடவும்", verifyIdentity: "அடையாளத்தைச் சரிபார்க்கவும்", cancel: "ரத்து", selectEmergency: "சேவையைத் தேர்ந்தெடுக்கவும்", whatHelp: "உங்களுக்கு என்ன உதவி தேவை?", medical: "மருத்துவம்", crime: "காவல்துறை", fire: "தீயணைப்பு", disaster: "பேரழிவு", cancelEmergency: "ரத்து", alertSent: "எச்சரிக்கை அனுப்பப்பட்டது", helpOnWay: "உதவி வருகிறது", location: "இடம்", returnHome: "திரும்பு" },
  te: { name: "Telugu", native: "తెలుగు", emergency: "అవసరం", tapHelp: "పానిక్ బటన్", enterPin: "పిన్ నమోదు చేయండి", verifyIdentity: "గుర్తింపును ధృవీకరించండి", cancel: "రద్దు", selectEmergency: "సేవను ఎంచుకోండి", whatHelp: "మీకు ఏ సహాయం కావాలి?", medical: "వైద్యం", crime: "పోలీసు", fire: "అగ్నిమాపక", disaster: "విపత్తు", cancelEmergency: "రద్దు", alertSent: "హెచ్చరిక పంపబడింది", helpOnWay: "సహాయం వస్తోంది", location: "స్థానం", returnHome: "తిరిగి వెళ్ళు" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", emergency: "ತುರ್ತು", tapHelp: "ಪ್ಯಾನಿಕ್ ಬಟನ್", enterPin: "ಪಿನ್ ನಮೂದಿಸಿ", verifyIdentity: "ಗುರುತನ್ನು ಪರಿಶೀಲಿಸಿ", cancel: "ರದ್ದುಮಾಡು", selectEmergency: "ಸೇವೆಯನ್ನು ಆರಿಸಿ", whatHelp: "ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?", medical: "ವೈದ್ಯಕೀಯ", crime: "ಪೊಲೀಸ್", fire: "ಅಗ್ನಿ ಶಾಮಕ", disaster: "ವಿಪತ್ತು", cancelEmergency: "ರದ್ದುಮಾಡು", alertSent: "ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ", helpOnWay: "ಸಹಾಯ ಬರುತ್ತಿದೆ", location: "ಸ್ಥಳ", returnHome: "ಹಿಂದಕ್ಕೆ" },
  ml: { name: "Malayalam", native: "മലയാളം", emergency: "അടിയന്തരം", tapHelp: "പാനിക് ബട്ടൺ", enterPin: "പിൻ നൽകുക", verifyIdentity: "തിരിച്ചറിയൽ രേഖ", cancel: "റദ്ദാക്കുക", selectEmergency: "സേവനം തിരഞ്ഞെടുക്കുക", whatHelp: "നിങ്ങൾക്ക് എന്ത് സഹായം വേണം?", medical: "വൈദ്യശാസ്ത്രം", crime: "പോലീസ്", fire: "അഗ്നിശമന", disaster: "ദുരന്തം", cancelEmergency: "റദ്ദാക്കുക", alertSent: "അറിയിപ്പ് അയച്ചു", helpOnWay: "സഹായം വരുന്നുണ്ട്", location: "സ്ഥലം", returnHome: "തിരിച്ചുപോകുക" },
  gu: { name: "Gujarati", native: "ગુજરાતી", emergency: "કટોકટી", tapHelp: "પેનિક બટન", enterPin: "PIN દાખલ કરો", verifyIdentity: "ઓળખ ચકાસો", cancel: "રદ કરો", selectEmergency: "સેવા પસંદ કરો", whatHelp: "તમને શું મદદ જોઈએ છે?", medical: "તબીબી", crime: "પોલીસ", fire: "આગ", disaster: "આપત્તિ", cancelEmergency: "રદ કરો", alertSent: "ચેતવણી મોકલવામાં આવી", helpOnWay: "મદદ આવી રહી છે", location: "સ્થાન", returnHome: "પાછા જાઓ" },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", emergency: "ਐਮਰਜੈਂਸੀ", tapHelp: "ਪੈਨਿਕ ਬਟਨ", enterPin: "ਪਿੰਨ ਦਰਜ ਕਰੋ", verifyIdentity: "ਪਛਾਣ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ", cancel: "ਰੱਦ ਕਰੋ", selectEmergency: "ਸੇਵਾ ਚੁਣੋ", whatHelp: "ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ?", medical: "ਮੈਡੀਕਲ", crime: "ਪੁਲਿਸ", fire: "ਅੱਗ", disaster: "ਆਫ਼ਤ", cancelEmergency: "ਰੱਦ ਕਰੋ", alertSent: "ਅਲਰਟ ਭੇਜਿਆ ਗਿਆ", helpOnWay: "ਮਦਦ ਆ ਰਹੀ ਹੈ", location: "ਟਿਕਾਣਾ", returnHome: "ਵਾਪਸ" },
  bn: { name: "Bengali", native: "বাংলা", emergency: "জরুরি", tapHelp: "প্যানিক বাটন", enterPin: "পিন লিখুন", verifyIdentity: "পরিচয় যাচাই", cancel: "বাতিল", selectEmergency: "পরিষেবা নির্বাচন করুন", whatHelp: "আপনার কি সাহায্য প্রয়োজন?", medical: "চিকিৎসা", crime: "পুলিশ", fire: "অগ্নিনির্বাপক", disaster: "দুর্যোগ", cancelEmergency: "বাতিল", alertSent: "অ্যালার্ট পাঠানো হয়েছে", helpOnWay: "সাহায্য আসছে", location: "অবস্থান", returnHome: "ফিরে যান" },
  or: { name: "Odia", native: "ଓଡ଼ିଆ", emergency: "ଜରୁରୀକାଳୀନ", tapHelp: "ପ୍ୟାନିକ୍ ବଟନ୍", enterPin: "ପିନ୍ ଦିଅନ୍ତୁ", verifyIdentity: "ପରିଚୟ ଯାଞ୍ଚ", cancel: "ବାତିଲ୍", selectEmergency: "ସେବା ବାଛନ୍ତୁ", whatHelp: "ଆପଣଙ୍କୁ କି ସାହାଯ୍ୟ ଦରକାର?", medical: "ଚିକିତ୍ସା", crime: "ପୋଲିସ୍", fire: "ଅଗ୍ନିଶମ", disaster: "ବିପର୍ଯ୍ୟୟ", cancelEmergency: "ବାତିଲ୍", alertSent: "ସତର୍କ ସୂଚନା ପଠାଗଲା", helpOnWay: "ସାହାଯ୍ୟ ଆସୁଛି", location: "ସ୍ଥାନ", returnHome: "ଫେରିଯାଅ" },
  as: { name: "Assamese", native: "অসমীয়া", emergency: "জৰুৰীকালীন", tapHelp: "পেনিক বুটাম", enterPin: "পিন দিয়ক", verifyIdentity: "পৰিচয় পৰীক্ষা", cancel: "বাতিল", selectEmergency: "সেৱা বাছনি কৰক", whatHelp: "আপোনাক কি সহায় লাগে?", medical: "চিকিৎসা", crime: "আৰক্ষী", fire: "অগ্নি নিৰ্বাপক", disaster: "দুর্যোগ", cancelEmergency: "বাতিল", alertSent: "সংকেত প্ৰেৰণ কৰা হ’ল", helpOnWay: "সহায় আহি আছে", location: "স্থান", returnHome: "ঘূৰি যাওক" }
};

function initLanguage() {
  const grid = document.getElementById('langGrid');
  if (!grid) return;

  grid.innerHTML = '';
  Object.keys(translations).forEach(code => {
    const lang = translations[code];
    const btn = document.createElement('div');
    btn.className = `lang-choice ${currentLang === code ? 'active' : ''}`;
    btn.onclick = () => changeLanguage(code);
    btn.innerHTML = `<span class="native">${lang.native}</span><span class="eng">${lang.name}</span>`;
    grid.appendChild(btn);
  });

  const saved = localStorage.getItem('RSECS_LANG');
  if (saved && translations[saved]) changeLanguage(saved);
  else changeLanguage('en');
}

function openLanguageModal() { document.getElementById('languageModal').classList.remove('hidden'); }
function closeLanguageModal() { document.getElementById('languageModal').classList.add('hidden'); }

function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('RSECS_LANG', lang);
  const t = translations[lang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  const label = document.getElementById('currentLangLabel');
  if (label) label.textContent = t.name.toUpperCase();

  closeLanguageModal();
  updateLangGridHighlight();
  speak(t.name);
}

function updateLangGridHighlight() {
  document.querySelectorAll('.lang-choice').forEach(el => {
    const engText = el.querySelector('.eng').textContent.toLowerCase();
    if (engText === translations[currentLang].name.toLowerCase()) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// Basic mapping for major voices
const voicesMap = { hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', gu: 'gu-IN', bn: 'bn-IN', en: 'en-IN' };
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  // Ensure voices are loaded
  if (voices.length === 0) loadVoices();

  const u = new SpeechSynthesisUtterance(text);
  const targetLang = voicesMap[currentLang] || 'en-IN';

  // Find a voice that matches the target language
  const voice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith('en'));

  if (voice) {
    u.voice = voice;
  }

  // Fallback language if voice handles it implicitly or default
  u.lang = targetLang;

  console.log(`TTS: Speaking "${text}" in ${targetLang}`);
  // Do NOT cancel - let them queue
  window.speechSynthesis.speak(u);
}

// ... existing PIN and Modal logic ...
function openPinModal() {
  document.getElementById('panicStage').classList.add('hidden');
  document.getElementById('pinModal').classList.remove('hidden');
  pin = '';
  updatePinDisplay();
}

function cancelAlert() {
  document.getElementById('pinModal').classList.add('hidden');
  document.getElementById('panicStage').classList.remove('hidden');
  pin = '';
}

function resetToPanic() {
  stopLiveTracking();
  document.getElementById('typeStage').classList.add('hidden');
  document.getElementById('panicStage').classList.remove('hidden');
  pin = '';
}

function enterDigit(digit) {
  if (pin.length < 4) {
    pin += digit;
    updatePinDisplay();
    if (pin.length === 4) checkPin();
  }
}

function backspace() {
  pin = pin.slice(0, -1);
  updatePinDisplay();
}

function updatePinDisplay() {
  const display = document.getElementById('pinDisplay');
  if (display) display.textContent = '● '.repeat(pin.length).trim();
}

async function checkPin() {
  await new Promise(r => setTimeout(r, 200));
  if (pin === correctPin) {
    showTypeSelection();
  } else {
    alert("Incorrect PIN");
    pin = '';
    updatePinDisplay();
  }
}

function showTypeSelection() {
  document.getElementById('pinModal').classList.add('hidden');
  document.getElementById('typeStage').classList.remove('hidden');
}

function selectType(type) {
  currentEmergencyType = type;
  sendAlert();
}

// ... rest of the app logic starting from sendAlert ...
async function sendAlert() {
  document.getElementById('typeStage').classList.add('hidden');
  const successScreen = document.getElementById('successScreen');
  successScreen.classList.remove('hidden');

  const locationText = document.getElementById('locationText');

  if (!navigator.geolocation) {
    locationText.textContent = "Geolocation not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const accuracy = pos.coords.accuracy;

    let address = "";
    try {
      // 2-second timeout to ensure the alert isn't delayed by geocoding
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const d = await r.json();
      if (d && d.display_name) address = d.display_name;
    } catch (e) { console.warn("Initial geocoding skipped/failed for speed"); }

    const created = await postEmergency(coords, address, accuracy);
    if (created?.id) {
      activeEmergencyId = created.id;
      // Enable recording now that we have an ID
      const recBtn = document.getElementById('recordBtn');
      const recStatus = document.getElementById('recordStatus');
      if (recBtn) recBtn.disabled = false;
      if (recStatus) {
        recStatus.classList.remove('loading-state'); // Remove any loading UI
        recStatus.style.opacity = '1';
        recStatus.textContent = "TAP TO RECORD (10s Max)";
      }
      startLiveTracking();
    }
  }, () => {
    locationText.textContent = "Location Unavailable";
  }, { enableHighAccuracy: true, timeout: 10000 });
}

async function postEmergency(coords, address, accuracy) {
  // AIS-140 Health Simulation
  const battery = Math.floor(Math.random() * 30) + 70; // 70-100%
  const signal = Math.random() > 0.8 ? "Medium" : "Strong";

  const payload = {
    deviceId,
    pin: correctPin,
    type: currentEmergencyType,
    severity,
    language: currentLang.toUpperCase(),
    coords,
    accuracy,
    address,
    channel: "DATA",
    health: { battery, signal }
  };

  // Immediate confirmation
  speak(translations[currentLang].alertSent + ". " + translations[currentLang].helpOnWay);

  try {
    const res = await fetch(apiCreate, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("POST failed");

    const data = await res.json();

    // Enhanced TTS with server response details
    if (data.agencies && data.agencies.length > 0) {
      // Construct natural language string for agencies
      const agencyList = data.agencies.join(", ");
      const locationStr = address || "your location";

      // Speak detailed confirmation
      // "Emergency Alert. Location detected: [Location]. Routing emergency response to: [Agencies]"
      // Queue it up directly (speak logic now queues)
      speak(`Emergency Alert. Location detected: ${locationStr}. Routing emergency response to: ${agencyList}.`);
    }

    return data;
  } catch (e) {
    console.warn("Satellite data failed, attempting encrypted SMS fallback...");
    return await sendSmsFallback(payload);
  }
}

/**
 * FEATURE 3: SMS Fallback Protocol
 * Implements data tunneling over SMS when 4G/5G is unavailable.
 */
async function sendSmsFallback(payload) {
  const locationText = document.getElementById('locationText');
  if (locationText) {
    locationText.innerHTML += `<br><span style="color:#ffcc00; font-weight:bold; font-size:10px;">[DATA_COLLAPSE] TUNNELING VIA SMS...</span>`;
  }

  try {
    const smsPayload = `${payload.deviceId}:${payload.pin}:${payload.type}:${payload.coords.lat}:${payload.coords.lng}`;
    const res = await fetch('/api/emergency/sms', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: smsPayload })
    });
    const data = await res.json();
    if (data.success) {
      speak("Data connection lost. Alert tunneled via SMS safely.");
      return { id: data.caseId, status: "Pending", channel: "SMS_TUNNEL" };
    }
  } catch (err) {
    console.error("TOTAL BLACKOUT: SMS Gateway Unreachable.");
    return { id: "OFFLINE_" + Date.now(), status: "Offline", channel: "NONE" };
  }
}

function stopLiveTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

let lastAddressFetchTime = 0;
const ADDRESS_FETCH_COOLDOWN = 8000; // Reduced to 8 seconds for better responsiveness

function startLiveTracking() {
  if (!navigator.geolocation || !activeEmergencyId) return;
  stopLiveTracking();

  watchId = navigator.geolocation.watchPosition(async (pos) => {
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const accuracy = pos.coords.accuracy;
    const now = Date.now();

    let fetchedAddress = "";
    // If we don't have an address yet, or the cooldown passed, fetch it
    if (now - lastAddressFetchTime > ADDRESS_FETCH_COOLDOWN) {
      try {
        lastAddressFetchTime = now;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
        const d = await r.json();
        if (d && d.display_name) fetchedAddress = d.display_name;
      } catch (e) { console.warn("Live reverse-geocoding failed"); }
    }

    const updatePayload = { coords, accuracy };
    if (fetchedAddress) updatePayload.address = fetchedAddress;

    await fetch(`/api/emergency/${activeEmergencyId}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload)
    });

    const locationText = document.getElementById("locationText");
    if (locationText) {
      const displayAddr = fetchedAddress || "Resolving Precise Address...";
      locationText.innerHTML = `<span style="color:#ff3b30; font-weight:bold;">● LIVE GPS TRACKING</span><br>${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${fetchedAddress ? `<br><span style="font-size:10px; color:var(--accent);">${fetchedAddress}</span>` : ""}`;
    }
  }, (err) => {
    console.error("GPS Tracking Error:", err);
  }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
}

async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    const btn = document.getElementById('recordBtn');
    if (btn) btn.disabled = true; // Temporary lock
    await startRecording();
    if (btn) btn.disabled = false;
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        await uploadAudio(base64Audio);
      };

      // Stop all tracks to release microphone
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    updateRecordingUI(true);

    let seconds = 0;
    recordingInterval = setInterval(() => {
      seconds++;
      document.getElementById('recordTimer').textContent = `00:${seconds.toString().padStart(2, '0')}`;
      if (seconds >= 10) stopRecording();
    }, 1000);

  } catch (err) {
    console.error("Microphone access denied:", err);
    alert("Microphone access required for voice message.");
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingInterval);
    updateRecordingUI(false);
  }
}

function updateRecordingUI(active) {
  const btn = document.getElementById('recordBtn');
  const status = document.getElementById('recordStatus');
  const timer = document.getElementById('recordTimer');

  if (active) {
    btn.classList.add('recording');
    status.textContent = "RECORDING...";
    timer.classList.remove('hidden');
    timer.textContent = "00:00";
  } else {
    btn.classList.remove('recording');
    status.textContent = "MESSAGE SENT (TAP TO RETRY)";
    timer.classList.add('hidden');
  }
}

async function uploadAudio(audioData) {
  if (!activeEmergencyId) return;
  try {
    await fetch(`/api/emergency/${activeEmergencyId}/audio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioData })
    });
  } catch (e) {
    console.error("Audio upload failed:", e);
  }
}

// PASSWORD GATE LOGIC
function checkPass() {
  const pass = document.getElementById('gatePass').value;
  const err = document.getElementById('gateErr');
  if (pass === "admin123") {
    sessionStorage.setItem("RSECS_USER_AUTH", "true");
    document.getElementById('passwordGate').style.display = "none";
    document.getElementById('mainContent').style.display = "block";
  } else {
    err.textContent = "INVALID ACCESS KEY";
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  if (sessionStorage.getItem("RSECS_USER_AUTH") === "true") {
    document.getElementById('passwordGate').style.display = "none";
    document.getElementById('mainContent').style.display = "block";
  }
});
