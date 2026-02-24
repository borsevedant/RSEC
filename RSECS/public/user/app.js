let currentEmergencyType = '';
let pin = '';
const correctPin = '1234';
const deviceId = "RSEC-PROTOTYPE-001";

const apiCreate = '/api/emergency';
let currentLang = 'en';

let activeEmergencyId = null;
let watchId = null;

const translations = {
    en: {
        emergency: "EMERGENCY", tapHelp: "PANIC BUTTON", enterPin: "Enter PIN", verifyIdentity: "Verify identity to proceed", cancel: "Cancel",
        selectEmergency: "SELECT EMERGENCY", whatHelp: "What helps do you need?", medical: "Medical", crime: "Crime", fire: "Fire", disaster: "Disaster",
        cancelEmergency: "Cancel Emergency", alertSent: "Alert Sent!", helpOnWay: "Help is on the way.", location: "Location", returnHome: "Return to Home"
    },
    hi: {
        emergency: "आपातकालीन", tapHelp: "पैनिक बटन", enterPin: "पिन दर्ज करें", verifyIdentity: "पहचान सत्यापित करें", cancel: "रद्द करें",
        selectEmergency: "आपातकालीन चुनें", whatHelp: "आपको क्या मदद चाहिए?", medical: "चिकित्सा", crime: "अपराध", fire: "आग", disaster: "आपदा",
        cancelEmergency: "रद्द करें", alertSent: "अलर्ट भेजा गया!", helpOnWay: "मदद रास्ते में है।", location: "स्थान", returnHome: "मुख्य पृष्ठ"
    },
    mr: {
        emergency: "आणीबाणी", tapHelp: "पॅनिक बटण", enterPin: "पिन प्रविष्ट करा", verifyIdentity: "ओळख पडताळा", cancel: "रद्द करा",
        selectEmergency: "आणीबाणी निवडा", whatHelp: "तुम्हाला कोणती मदत हवी आहे?", medical: "वैद्यकीय", crime: "गुन्हा", fire: "आग", disaster: "आपत्ती",
        cancelEmergency: "रद्द करा", alertSent: "अलर्ट पाठवला!", helpOnWay: "मदत येत आहे.", location: "स्थान", returnHome: "मुख्य पृष्ठ"
    }
};

function changeLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
}

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
    document.getElementById('pinDisplay').textContent = '*'.repeat(pin.length);
}

async function checkPin() {
    await new Promise(r => setTimeout(r, 200));
    // In prototype, any 4 digits work for the user experience, but we can check if needed
    showTypeSelection();
}

function showTypeSelection() {
    document.getElementById('pinModal').classList.add('hidden');
    document.getElementById('typeStage').classList.remove('hidden');
}

function selectType(type) {
    currentEmergencyType = type;
    sendAlert();
}

function sendAlert() {
    document.getElementById('typeStage').classList.add('hidden');
    document.getElementById('successScreen').classList.remove('hidden');

    const locationText = document.getElementById('locationText');

    if (!navigator.geolocation) {
        locationText.textContent = "Geolocation not supported";
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = pos.coords.accuracy;

        let address = "Unknown Location";
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
            const d = await r.json();
            if (d && d.display_name) address = d.display_name;
        } catch { }

        locationText.textContent = `${address} (±${Math.round(accuracy)}m)`;

        const created = await postEmergency(coords, address);
        if (created?.id) {
            activeEmergencyId = created.id;
            startLiveTracking();
        }
    }, () => {
        locationText.textContent = "Location Unavailable";
    }, { enableHighAccuracy: true, timeout: 10000 });
}

async function postEmergency(coords, address) {
    const payload = {
        deviceId,
        type: currentEmergencyType,
        language: currentLang,
        coords,
        address,
        pinOk: true
    };

    try {
        const res = await fetch(apiCreate, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) {
        console.error("Failed to post alert", e);
        return null;
    }
}

function startLiveTracking() {
    if (!navigator.geolocation || !activeEmergencyId) return;

    watchId = navigator.geolocation.watchPosition(async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        await fetch(`/api/emergency/${activeEmergencyId}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coords })
        });

        const locationText = document.getElementById("locationText");
        if (locationText) {
            locationText.textContent = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        }
    }, () => { }, { enableHighAccuracy: true });
}

function stopLiveTracking() {
    if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}
