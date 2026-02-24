const token = sessionStorage.getItem("RSECS_TOKEN");
const role = sessionStorage.getItem("RSECS_ROLE") || "";
const user = sessionStorage.getItem("RSECS_USER") || "";

if (!token) {
  window.location.href = "login.html";
} else {
  document.body.style.display = "block";
  // Force map to recalculate size after becoming visible
  if (window.map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}

// Ensure map recalculates on window resize
window.addEventListener('resize', () => {
  if (window.map) map.invalidateSize();
});

// UI Elements
const who = document.getElementById("who");
if (who) who.textContent = user;
const roleEl = document.querySelector(".profile-info span");
if (roleEl) roleEl.textContent = `${role.toUpperCase()}_OPERATOR`;

// Map Initialization
const map = L.map('map', { zoomControl: false }).setView([19.7515, 75.7139], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Track user interaction to stop auto-panning
window.mapInteracted = false;
map.on('mousedown touchstart zoomstart', () => {
  window.mapInteracted = true;
  // Reset after 30 seconds of no interaction if needed, or provide a "Re-center" button
  setTimeout(() => window.mapInteracted = false, 30000);
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CARTO'
}).addTo(map);

// Set to keep track of unit selections per emergency to persist through re-renders
const selectedUnitsStore = {};
const markers = {};
const knownEmergencies = new Set();
const availableUnits = ['Police', 'Ambulance', 'Fire Dept', 'DDMA', 'SDMA'];

// Bhuvan Layer (ISRO) Simulation
let currentMapType = 'OSM';
const bhuvanTileUrl = 'https://bhuvan-app1.nrsc.gov.in/tilecache/tilecache.py/1.0.0/hyderabad_2016/{z}/{x}/{y}.png'; // Demo Bhuvan-like
const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

// Audio State
let isAudioEnabled = false;

function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  const btn = document.getElementById('audioBtn');
  if (isAudioEnabled) {
    btn.innerHTML = '<i class="fas fa-volume-up"></i> AUDIO: ON';
    btn.style.color = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
  } else {
    btn.innerHTML = '<i class="fas fa-volume-mute"></i> AUDIO: OFF';
    btn.style.color = '';
    btn.style.borderColor = '';
    window.speechSynthesis.cancel();
  }
}

// Delta Sync Globals
let lastSyncTimestamp = 0;
let allEmergencies = [];
let allVolunteers = [];

function toggleMap() {
  const btn = document.getElementById('mapBtn');
  const layers = ['OSM', 'BHUVAN', 'BHUVAN_LULC'];
  let currentIdx = layers.indexOf(currentMapType);
  if (currentIdx === -1) currentIdx = 0;

  const nextIdx = (currentIdx + 1) % layers.length;
  const nextType = layers[nextIdx];

  // Remove existing dynamic layers
  if (window.currentDynamicLayer) map.removeLayer(window.currentDynamicLayer);
  if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);

  if (nextType === 'OSM') {
    osmLayer.addTo(map);
    btn.innerHTML = '<i class="fas fa-map-marked-alt"></i> MAP: OSM';
    btn.style.background = '#444';
  } else if (nextType === 'BHUVAN') {
    window.currentDynamicLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'ISRO Bhuvan Satellite Proxy'
    }).addTo(map);
    btn.innerHTML = '<i class="fas fa-satellite"></i> MAP: BHUVAN';
    btn.style.background = 'var(--accent)';
  } else if (nextType === 'BHUVAN_LULC') {
    window.currentDynamicLayer = L.tileLayer('https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=demo', {
      attribution: 'ISRO Bhuvan LULC Proxy'
    }).addTo(map);
    btn.innerHTML = '<i class="fas fa-tree"></i> MAP: LULC';
    btn.style.background = 'var(--success)';
  }

  currentMapType = nextType;
}

async function fetchVolunteers() {
  try {
    const res = await fetch('/api/volunteers', { headers: { "X-Auth-Token": token } });
    allVolunteers = await res.json();

    allVolunteers.forEach(v => {
      if (!volunteerMarkers[v.id]) {
        const icon = L.divIcon({
          className: 'volunteer-marker-container',
          html: `<i class="fas fa-user-shield" style="color:var(--success); font-size:16px; filter: drop-shadow(0 0 3px rgba(0,0,0,0.8));"></i>`,
          iconSize: [20, 20]
        });
        const m = L.marker([v.coords.lat, v.coords.lng], { icon }).addTo(map);
        m.bindPopup(`<b>CITIZEN VOLUNTEER</b><br>${v.name}<br>${v.role}`);
        volunteerMarkers[v.id] = m;
      }
    });
  } catch (e) {
    console.error("Volunteer Sync Error:", e);
  }
}
/**
 * VOLUNTEER NETWORK: DEACTIVATED (Enable when needed)
 * fetchVolunteers();
 * setInterval(fetchVolunteers, 30000);
 */

async function fetchEmergencies() {
  try {
    const response = await fetch(`/api/emergencies?since=${lastSyncTimestamp}`, {
      headers: { "X-Auth-Token": token }
    });

    if (response.status === 401) {
      sessionStorage.clear();
      window.location.href = "login.html";
      return;
    }

    const data = await response.json();

    // Update Sync Timestamp
    if (data.timestamp) lastSyncTimestamp = data.timestamp;

    const updates = data.updates || [];

    if (updates.length > 0) {
      // Merge updates into local cache
      updates.forEach(u => {
        const idx = allEmergencies.findIndex(e => e.id === u.id);
        if (idx >= 0) {
          allEmergencies[idx] = u;
        } else {
          allEmergencies.push(u);
        }
      });

      // Sort: Newest first
      allEmergencies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      updateDashboardUI();
    } else {
      // No updates, but maybe check for removed/closed items if we had a full sync strategy
      // For now, just update the counter in case
      updateCounters();
    }

  } catch (error) {
    console.error("Dashboard Sync Error:", error);
  }
}

function updateCounters() {
  const counter = document.getElementById('activeCounter');
  if (counter) counter.textContent = allEmergencies.filter(e => e.status !== 'Closed').length;
}

function updateDashboardUI() {
  const listContainer = document.getElementById('emergencyList');
  updateCounters();

  if (allEmergencies.length > 0) {
    const empty = listContainer.querySelector('.empty-state');
    if (empty) empty.remove();
  }

  // efficiently update DOM
  allEmergencies.forEach((emergency, index) => {
    // Only render top 50 to prevent lag (Virtualization Lite)
    if (index > 50) return;

    let card = document.getElementById(`emergency-${emergency.id}`);
    if (!card) {
      // Initialize unit selection from auto-route if new
      selectedUnitsStore[emergency.id] = new Set(emergency.agenciesAuto || []);
      card = createEmergencyCard(emergency);

      // Insert in correct order (since list is sorted, just append/prepend logic is tricky with updates)
      // Simplest strategy for "Live Feed": Prepend if new and matches order, or just re-append if needed.
      // But since we are sorting by time, and ID increases, prepending usually works for new.
      // For updates to existing, we just update the card in place.

      // If index 0 (newest), prepend. 
      // If not, we might need to find the correct spot, but for now let's just prepend to top.
      // Actually, to keep order correct, we should ideally re-sort DOM, but that's expensive.
      // "Live Feed" style: Newest on top.

      const nextSibling = listContainer.children[index];
      if (nextSibling) {
        listContainer.insertBefore(card, nextSibling);
      } else {
        listContainer.appendChild(card);
      }

    } else {
      // Update marker and card data
      updateEmergencyCard(card, emergency);

      // Ensure order (if timestamp changed or other cards moved)
      // Check if card is at correct index
      const currentIdx = Array.from(listContainer.children).indexOf(card);
      if (currentIdx !== index) {
        const nextSibling = listContainer.children[index];
        if (nextSibling) listContainer.insertBefore(card, nextSibling);
      }
    }

    // Map Markers (Update or Create)
    updateMapMarker(emergency, index);

    if (!knownEmergencies.has(emergency.id)) {
      playHighSecurityTTS(emergency);
      knownEmergencies.add(emergency.id);
    }
  });

  // Remove cards that are no longer in the top 50 (if any) or closed and filtered out (if we add filtering)
  // For now, we keep them.
}

function updateMapMarker(emergency, index) {
  if (!markers[emergency.id]) {
    const pulseIcon = L.divIcon({
      className: 'pulse-marker-container',
      html: `<div class="pulse-circle"></div>`,
      iconSize: [20, 20]
    });

    const marker = L.marker([emergency.coords.lat, emergency.coords.lng], { icon: pulseIcon }).addTo(map);
    marker.bindPopup(`
          <div style="color:#000;">
            <b>${emergency.type.toUpperCase()}</b><br>
            <small>ID: ${emergency.caseId || emergency.id}</small>
          </div>
        `);
    markers[emergency.id] = marker;
  } else {
    markers[emergency.id].setLatLng([emergency.coords.lat, emergency.coords.lng]);
  }

  if (index === 0 && !window.mapInteracted) {
    // Auto-pan to newest if user hasn't interacted recently
    map.flyTo([emergency.coords.lat, emergency.coords.lng], 13);
  }
}

function createEmergencyCard(data) {
  const card = document.createElement('div');
  card.id = `emergency-${data.id}`;
  card.setAttribute('data-status', data.status);
  card.setAttribute('data-coords', `${data.coords.lat},${data.coords.lng}`);
  card.className = `emergency-card ${data.status.toLowerCase()}`;
  updateEmergencyCardHTML(card, data);
  return card;
}

function updateEmergencyCard(card, data) {
  const oldStatus = card.getAttribute('data-status');
  const oldCoords = card.getAttribute('data-coords');
  const newCoords = `${data.coords.lat},${data.coords.lng}`;

  const hasAudio = !!data.audioMessage;
  const cardHasAudio = !!card.getAttribute('data-has-audio');

  // Re-render if status, position, or audio presence changed
  if (oldStatus !== data.status || oldCoords !== newCoords || hasAudio !== cardHasAudio) {
    if (hasAudio) card.setAttribute('data-has-audio', 'true');
    card.setAttribute('data-status', data.status);
    card.setAttribute('data-coords', newCoords);
    card.className = `emergency-card ${data.status.toLowerCase()}`;
    updateEmergencyCardHTML(card, data);
  }
}

function updateEmergencyCardHTML(card, data) {
  const time = new Date(data.timestamp).toLocaleTimeString();
  const statusPillClass = data.status === 'Dispatched' ? 'pill-dispatched' : 'pill-pending';

  // High-Security: Optional Chaining for Government Data
  const battery = data.health?.battery ?? 100;
  const signal = data.health?.signal ?? "Strong";
  const sops = data.sopStatus || [];
  const score = data.smartScore || 0;
  const scoreClass = score > 70 ? 'high' : (score > 40 ? 'medium' : 'low');

  card.innerHTML = `
        <div class="card-status-pill ${statusPillClass}">${data.status}</div>
        
        <!-- FEATURE 1: AI SMART SCORE -->
        <div class="smart-score-container ${scoreClass}">
            <span class="score-val">${score}</span>
            <span class="score-lbl">AI RANK</span>
        </div>

        <div class="card-header">
            <span class="incident-type">${data.type}</span>
            <span class="incident-id">#${data.caseId || data.id}</span>
        </div>
        <div class="card-details">
            <b>TIME:</b> ${time}<br>
            <div style="margin: 5px 0; font-size: 10px; display: flex; align-items: center; gap: 5px;">
                <span style="color:var(--critical); font-weight:bold; animation: pulse-red 1.5s infinite;">● LIVE</span>
                <span id="sync-timer-${data.id}" style="color:var(--text-dim);">
                    Updated: ${Math.round((Date.now() - new Date(data.lastLocationUpdate).getTime()) / 1000)}s ago
                </span>
            </div>
            <b>LOCATION:</b> <span style="color:var(--accent); font-weight:bold;">${data.coords.lat.toFixed(5)}, ${data.coords.lng.toFixed(5)}</span><br>
            <b>LIVE ADDRESS:</b> <span style="font-size:10px; color:var(--text-main);">${(data.address && data.address !== "Acquiring address..." && data.address !== "") ? data.address : `Precise Location: ${data.coords.lat.toFixed(5)}, ${data.coords.lng.toFixed(5)}`}</span><br>
            <div style="font-size:9px; color:var(--text-dim); margin-top:5px; border-top:1px solid rgba(255,255,255,0.05); padding-top:2px;">
                REGISTERED BASE: ${data.village}, ${data.district}
            </div>
            <b>DEVICE:</b> ${data.deviceId} | 
            ${data.accuracy && data.accuracy < 20 ?
      `<span style="color:var(--success); font-weight:bold; font-size:10px;"><i class="fas fa-crosshairs"></i> EXACT GPS (±${Math.round(data.accuracy)}m)</span>` :
      `<span style="color:var(--accent); font-size:10px;"><i class="fas fa-satellite"></i> Tracking via NavIC/GPS</span>`}
        </div>
        <div class="device-health-bar">
            <span title="Battery"><i class="fas fa-battery-three-quarters"></i> ${battery}%</span>
            <span title="Signal"><i class="fas fa-signal"></i> ${signal}</span>
        </div>
        
        <div class="sop-checklist">
            <h4>GOVT STANDARD PROTOCOL (SOP)</h4>
            ${sops.map(sop => `
                <div class="sop-item ${sop.completed ? 'completed' : ''}" onclick="toggleSOP('${data.id}', '${sop.id}')">
                    <i class="far ${sop.completed ? 'fa-check-square' : 'fa-square'}"></i>
                    <span>${sop.text}</span>
                </div>
            `).join('')}
            ${sops.length === 0 ? '<p style="font-size:10px; opacity:0.6;">No SOPs defined for this type.</p>' : ''}
        </div>

        <!-- FEATURE 2: VOLUNTEER NETWORK (Deactivated) -->
        <!--
        <div class="sop-checklist" style="margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
            <h4><i class="fas fa-users"></i> NEARBY VOLUNTEERS</h4>
            ${allVolunteers
      .filter(v => Math.abs(v.coords.lat - data.coords.lat) < 0.1 && Math.abs(v.coords.lng - data.coords.lng) < 0.1)
      .map(v => `
                <div style="font-size:9px; display:flex; justify-content:space-between; margin-bottom:4px; color:var(--success);">
                    <span><b>${v.name}</b> (${v.role})</span>
                    <span>READY</span>
                </div>
              `).join('')}
            ${allVolunteers.filter(v => Math.abs(v.coords.lat - data.coords.lat) < 0.1 && Math.abs(v.coords.lng - data.coords.lng) < 0.1).length === 0 ? '<p style="font-size:9px; opacity:0.5;">No volunteers in vicinity.</p>' : ''}
        </div>
        -->
        </div>

        ${data.audioMessage ? `
        <div class="audio-message-box" style="margin-top:10px;">
            <button class="play-btn" onclick="playAudio('${data.id}')" style="width:100%; height:70px; font-size:13px; background:rgba(0,242,255,0.1); border:2px solid var(--accent); border-radius:10px;">
                <i class="fas fa-microphone-alt" style="font-size:20px; margin-bottom:4px;"></i><br>
                LISTEN TO VOICE MESSAGE
            </button>
            <audio id="audio-${data.id}" src="${data.audioMessage}"></audio>
        </div>
        ` : ''}

        <!-- Compliance & Reports Area -->
        <div class="dispatch-controls" style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <button class="dispatch-btn" onclick="window.open('/report/${data.id}?token=${token}', '_blank')">
                <i class="fas fa-file-invoice"></i> REPORT
            </button>
            <button class="dispatch-btn" onclick="window.open('/api/emergency/${data.id}/cap?token=${token}', '_blank')">
                <i class="fas fa-file-code"></i> CAP
            </button>
        </div>

        <button class="dispatch-btn" style="width:100%; margin-top:8px; color:var(--accent); border-style:dashed;" onclick="verifyAuditTrail('${data.id}')">
            <i class="fas fa-shield-halved"></i> VERIFY AUDIT LOG
        </button>

        <div class="dispatch-controls" id="dispatch-area-${data.id}" style="margin-top:15px; border-top:1px solid var(--border); padding-top:15px;"></div>
    `;

  // 2. Dispatch Area
  if (data.status !== 'Dispatched' && data.status !== 'Closed') {
    const dispatchArea = card.querySelector(`#dispatch-area-${data.id}`);
    const selectedUnits = selectedUnitsStore[data.id] || new Set(data.agenciesAuto || []);

    availableUnits.forEach(unit => {
      const btn = document.createElement('button');
      btn.className = `dispatch-btn ${selectedUnits.has(unit) ? 'selected' : ''}`;
      btn.textContent = unit;
      btn.onclick = (e) => {
        e.stopPropagation();
        btn.classList.toggle('selected');
        if (selectedUnits.has(unit)) selectedUnits.delete(unit);
        else selectedUnits.add(unit);
        selectedUnitsStore[data.id] = selectedUnits; // Save state
      };
      dispatchArea.appendChild(btn);
    });

    const dispatchAction = document.createElement('button');
    dispatchAction.id = `dispatch-btn-${data.id}`;
    dispatchAction.className = 'dispatch-action';
    dispatchAction.style.width = '100%';
    dispatchAction.innerHTML = '<i class="fas fa-paper-plane"></i> DISPATCH';
    dispatchAction.onclick = async () => {
      const units = Array.from(selectedUnits);
      if (units.length === 0) {
        alert('Assign at least one unit first.');
        return;
      }

      dispatchAction.disabled = true;
      dispatchAction.innerHTML = '<i class="fas fa-spinner fa-spin"></i> DISPATCHING...';

      const success = await dispatchUnits(data.id, units);
      if (success) {
        dispatchAction.style.background = 'var(--success)';
        dispatchAction.innerHTML = '<i class="fas fa-check"></i> DISPATCHED';
      } else {
        dispatchAction.disabled = false;
        dispatchAction.innerHTML = '<i class="fas fa-paper-plane"></i> RETRY DISPATCH';
        alert('Dispatch protocol failed. Check network.');
      }
    };
    card.appendChild(dispatchAction);
  } else if (data.status === 'Dispatched') {
    const info = document.createElement('div');
    info.className = 'card-details';
    info.style.marginTop = '10px';
    info.style.padding = '10px';
    info.style.background = 'rgba(0,255,242,0.1)';
    info.style.borderRadius = '8px';
    info.innerHTML = `<b>DISPATCHED:</b> ${data.dispatchedUnits.join(', ')}`;
    card.appendChild(info);
  }
}

function playHighSecurityTTS(emergency) {
  if (!('speechSynthesis' in window) || !isAudioEnabled) return;

  // Use server side built TTS if available (multi-lingual)
  const tts = emergency.ttsText || {};
  const text = tts.en || `New ${emergency.type} incident reported in ${emergency.village}.`;

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'en-IN';
  msg.rate = 0.95;
  msg.pitch = 1.1; // Professional command center tone

  // If incident language is not English, speak it first or after
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

// Global Sync
setInterval(fetchEmergencies, 3000);
fetchEmergencies();

async function dispatchUnits(id, units) {
  try {
    const response = await fetch(`/api/emergency/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "X-Auth-Token": token },
      body: JSON.stringify({ units })
    });
    if (!response.ok) throw new Error("API error");
    fetchEmergencies();
    return true;
  } catch (e) {
    console.error("Dispatch Protocol Failed:", e);
    return false;
  }
}

async function verifyAuditTrail(id) {
  try {
    const r = await fetch(`/api/emergency/${id}/verify-audit`, {
      headers: { "X-Auth-Token": token }
    });
    const d = await r.json();
    alert(d.message);
  } catch (e) {
    alert("Verification Service Unavailable");
  }
}

async function toggleSOP(emergencyId, sopId) {
  try {
    await fetch(`/api/emergency/${emergencyId}/sop/${sopId}`, {
      method: 'POST',
      headers: { "X-Auth-Token": token }
    });
    fetchEmergencies();
  } catch (e) {
    console.error("SOP Update Failed:", e);
  }
}



function playAudio(id) {
  const audio = document.getElementById(`audio-${id}`);
  const btn = audio.parentElement.querySelector('.play-btn');

  if (audio) {
    if (audio.paused) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> LOADING...';

      audio.play().then(() => {
        btn.innerHTML = '<i class="fas fa-pause"></i> PAUSE VOICE MESSAGE';
      }).catch(e => {
        console.error("Playback failed:", e);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> PLAYBACK ERROR';
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-play"></i> PLAY VOICE MESSAGE';
        }, 2000);
      });

      audio.onended = () => {
        btn.innerHTML = '<i class="fas fa-play"></i> PLAY VOICE MESSAGE';
      };
    } else {
      audio.pause();
      btn.innerHTML = '<i class="fas fa-play"></i> PLAY VOICE MESSAGE';
    }
  }
}

updateClock();
setInterval(updateClock, 1000);
function updateClock() {
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = new Date().toTimeString().split(' ')[0];
}
