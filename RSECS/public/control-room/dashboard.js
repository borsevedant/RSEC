const token = localStorage.getItem("RSECS_TOKEN");
const role = localStorage.getItem("RSECS_ROLE") || "";
const user = localStorage.getItem("RSECS_USER") || "";

if (!token) {
    window.location.href = "login.html";
}

const who = document.getElementById("who");
if (who) who.textContent = `${user} (${role})`;

// Map Initialization (center on Maharashtra)
const map = L.map('map').setView([19.7515, 75.7139], 6);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

const markers = {};
const knownEmergencies = new Set();
const availableUnits = ['Police', 'Ambulance', 'Fire Dept', 'DDMA', 'SDMA'];

function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);

function logout() {
    localStorage.removeItem("RSECS_TOKEN");
    localStorage.removeItem("RSECS_ROLE");
    localStorage.removeItem("RSECS_USER");
    window.location.href = "login.html";
}

async function fetchEmergencies() {
    try {
        const response = await fetch('/api/emergencies', {
            headers: { "X-Auth-Token": token }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const emergencies = await response.json();
        const listContainer = document.getElementById('emergencyList');

        emergencies.forEach(emergency => {
            let card = document.getElementById(`emergency-${emergency.id}`);
            if (!card) {
                card = createEmergencyCard(emergency);
                listContainer.prepend(card);
            } else {
                updateEmergencyCard(card, emergency);
            }

            const latlng = [emergency.coords.lat, emergency.coords.lng];

            if (!markers[emergency.id]) {
                const marker = L.marker(latlng).addTo(map);

                let popupContent = `<b>${emergency.type.toUpperCase()}</b><br>ID: ${emergency.id}`;
                if (emergency.address) popupContent += `<br><small>${emergency.address}</small>`;
                if (emergency.deviceId) popupContent += `<br><small>Device: ${emergency.deviceId}</small>`;

                marker.bindPopup(popupContent);
                markers[emergency.id] = marker;
            } else {
                markers[emergency.id].setLatLng(latlng);
            }

            if (!knownEmergencies.has(emergency.id)) {
                playVoiceAlert(emergency.type);
                knownEmergencies.add(emergency.id);
            }
        });

    } catch (error) {
        console.error("Error fetching emergencies:", error);
    }
}

function createEmergencyCard(data) {
    const card = document.createElement('div');
    card.id = `emergency-${data.id}`;
    card.className = `emergency-card ${data.status === 'Dispatched' ? 'dispatched' : ''}`;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<span>${data.type.toUpperCase()}</span> <span>#${data.id}</span>`;
    card.appendChild(header);

    const details = document.createElement('div');
    details.className = 'card-details';
    updateCardDetailsHTML(details, data);
    card.appendChild(details);

    if (data.status !== 'Dispatched') {
        const controls = document.createElement('div');
        controls.className = 'dispatch-controls';

        const selectedUnits = new Set();

        availableUnits.forEach(unit => {
            const btn = document.createElement('button');
            btn.className = 'dispatch-btn';
            btn.textContent = unit;
            btn.onclick = () => {
                if (selectedUnits.has(unit)) {
                    selectedUnits.delete(unit);
                    btn.classList.remove('selected');
                } else {
                    selectedUnits.add(unit);
                    btn.classList.add('selected');
                }
            };
            controls.appendChild(btn);
        });

        const dispatchAction = document.createElement('button');
        dispatchAction.className = 'dispatch-action';
        dispatchAction.textContent = 'DISPATCH SELECTED UNITS';
        dispatchAction.onclick = () => {
            if (selectedUnits.size > 0) dispatchUnits(data.id, Array.from(selectedUnits));
            else alert('Select at least one unit.');
        };

        card.appendChild(controls);
        card.appendChild(dispatchAction);
    }

    return card;
}

function updateEmergencyCard(card, data) {
    if (data.status === 'Dispatched' && !card.classList.contains('dispatched')) {
        card.classList.add('dispatched');
        const controls = card.querySelector('.dispatch-controls');
        const actionBtn = card.querySelector('.dispatch-action');
        if (controls) controls.remove();
        if (actionBtn) actionBtn.remove();
    }

    const details = card.querySelector('.card-details');
    updateCardDetailsHTML(details, data);
}

function updateCardDetailsHTML(container, data) {
    const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A';
    const address = data.address ? `<div style="margin-top:5px; color:#fff;">📍 ${data.address}</div>` : '';
    const device = data.deviceId ? `<div style="margin-top:5px;">🆔 ${data.deviceId}</div>` : '';

    let html = `Time: ${time}<br>Loc: ${data.coords.lat.toFixed(4)}, ${data.coords.lng.toFixed(4)}${address}${device}<br>Status: <b>${data.status}</b>`;

    if (data.status === 'Dispatched') {
        html += `<br>Units: ${Array.isArray(data.dispatchedUnits) ? data.dispatchedUnits.join(', ') : ''}`;
    }
    container.innerHTML = html;
}

async function dispatchUnits(id, units) {
    try {
        await fetch(`/api/emergency/${id}/dispatch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "X-Auth-Token": token
            },
            body: JSON.stringify({ units })
        });
        fetchEmergencies();
    } catch (e) {
        console.error("Dispatch failed", e);
    }
}

function playVoiceAlert(type) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`Attention control room. New ${type} emergency reported.`);
        msg.lang = 'en-IN';
        msg.rate = 1;
        window.speechSynthesis.speak(msg);
    }
}

setInterval(fetchEmergencies, 2000);
fetchEmergencies();
