const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// Static middleware for sub-directories to handle relative asset paths
app.use("/user", express.static(path.join(__dirname, "public", "user")));
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));
app.use(express.static(path.join(__dirname, "public")));

// Limit in-memory storage
const MAX_EMERGENCIES = 1000;

/* =========================
   EMERGENCY SOPS
========================= */
const EMERGENCY_SOPS = {
  "medical": [
    { id: "s1", text: "Validate location coordinates with caller" },
    { id: "s2", text: "Dispatch nearest Ambulance & PHC" },
    { id: "s3", text: "Notify trauma center of incoming patient" }
  ],
  "fire": [
    { id: "s1", text: "Alert nearest Fire Station" },
    { id: "s2", text: "Dispatch water tanker & ambulance" },
    { id: "s3", text: "Request traffic police for route clearance" }
  ],
  "crime": [
    { id: "s1", text: "Identify incident severity (Armed/Unarmed)" },
    { id: "s2", text: "Dispatch local PCR and notify district HQ" },
    { id: "s3", text: "Coordinate backup units via wireless" }
  ],
  "disaster": [
    { id: "s1", text: "Activate SDMA/DDMA emergency response" },
    { id: "s2", text: "Notify NDRF if intensity is Level-2+" },
    { id: "s3", text: "Broadcast local area warning via CAP" }
  ]
};

// Device Registry (Demo)
const devices = {
  "RSECS-001": { pin: "1234", village: "Koregaon", district: "Satara", state: "Maharashtra" },
  "RSECS-002": { pin: "4321", village: "Wai", district: "Satara", state: "Maharashtra" },
  "RSECS-003": { pin: "1111", village: "Sinnar", district: "Nashik", state: "Maharashtra" }
};

const volunteers = [
  { id: "V001", name: "Dr. Aryan", role: "Medical (Doctor)", coords: { lat: 19.72, lng: 75.68 }, village: "Koregaon" },
  { id: "V002", name: "Capt. Sameer", role: "First Responder (Ex-Army)", coords: { lat: 18.01, lng: 73.88 }, village: "Wai" },
  { id: "V003", name: "Sneha Patil", role: "Medical (Nurse)", coords: { lat: 19.98, lng: 73.92 }, village: "Sinnar" },
  { id: "V004", name: "Rahul Deshmukh", role: "Civil Defense", coords: { lat: 19.75, lng: 75.72 }, village: "Koregaon" }
];

// Helper: Immutable Log Chaining
function addToAuditLog(emergency, action, by, details = {}) {
  const lastEntry = (emergency.auditLog && emergency.auditLog.length > 0)
    ? emergency.auditLog[emergency.auditLog.length - 1]
    : null;
  const prevHash = lastEntry ? lastEntry.hash : "INITIAL_GENESIS_BLOCK";

  const entry = {
    time: new Date().toISOString(),
    action,
    by,
    details,
    prevHash
  };

  const hashInput = JSON.stringify({
    time: entry.time,
    action: entry.action,
    by: entry.by,
    details: entry.details,
    prevHash: entry.prevHash
  }) + prevHash;
  entry.hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  entry.signature = crypto.createHmac('sha256', 'GOVT_SECURE_KEY_123').update(entry.hash).digest('base64');

  if (!emergency.auditLog) emergency.auditLog = [];
  emergency.auditLog.push(entry);
}

/* =========================
   AUTH LOGIC
========================= */
const users = {
  "admin": { password: "admin123", role: "admin" }
};

const tokens = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function authRequired(req, res, next) {
  const token = req.header("X-Auth-Token") || req.query.token;
  if (!token || !tokens.has(token)) return res.status(401).json({ error: "Unauthorized" });
  req.user = tokens.get(token);
  next();
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    // In this unified model, admin is the only role needed for protected actions
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

/* =========================
   Emergency store
========================= */
let emergencies = [];
let nextId = 1;
const lastAlertByDevice = new Map();
const COOLDOWN_MS = 60 * 1000;
const ESCALATE_AFTER_SEC = 30;
const ESCALATE_LEVEL2_SEC = 60;

function routeAgencies(type) {
  switch ((type || "").toLowerCase()) {
    case "medical": return ["Ambulance", "PHC"];
    case "crime": return ["Police", "Control Room"];
    case "fire": return ["Fire Dept", "Ambulance"];
    case "natural disaster":
    case "disaster": return ["DDMA", "SDMA", "Police", "Ambulance"];
    default: return ["Police"];
  }
}

function priorityFrom(type, severity) {
  if (severity === "High") return "P1";
  const t = (type || "").toLowerCase();
  if (t.includes("medical") || t.includes("fire") || t.includes("disaster")) return "P1";
  return "P2";
}

function calculateSmartScore(e) {
  let score = 0;
  const typeWeights = { disaster: 50, fire: 45, medical: 40, crime: 25, default: 20 };
  score += typeWeights[e.type.toLowerCase()] || typeWeights.default;
  if (e.severity === "High") score += 30;
  else if (e.severity === "Medium") score += 10;
  if (e.agenciesAuto && e.agenciesAuto.length > 2) score += 10;
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 5) score += 5;
  return Math.min(score, 100);
}

function getDynamicSOPs(type, meta, e) {
  let base = [...(EMERGENCY_SOPS[type.toLowerCase()] || [])];
  if (e.severity === "High") {
    base.unshift({ id: "dyn_high", text: "CRITICAL: Bypass hierarchy - Alert District Emergency Response Center (DERC)" });
  }
  if (e.health && e.health.battery < 20) {
    base.push({ id: "dyn_batt", text: "DEVICE WARNING: Low Battery. Prioritize data bursts over voice." });
  }
  if (meta.village === "Koregaon") {
    base.push({ id: "dyn_loc", text: "TRAFFIC ADVISORY: Deploy local volunteers for bypass route clearance." });
  }
  return base.map(s => ({ ...s, completed: false }));
}

function buildTTS(type, meta) {
  const loc = meta.address || `${meta.village}, ${meta.district}`;
  const agenciesEn = meta.agencies.join(", ");
  const agenciesMr = meta.agencies.join(" आणि ");
  const agenciesHi = meta.agencies.join(" और ").replace(/, /g, " और ");

  return {
    en: `Attention control room. ${type} emergency from ${loc}. Recommended dispatch: ${agenciesEn}.`,
    hi: `नियंत्रण कक्ष ध्यान दें। ${loc} से ${type} आपातकालीन संदेश प्राप्त हुआ है। अनुशंसित सहायता: ${agenciesHi}.`,
    mr: `नियंत्रण कक्ष लक्ष द्या. ${loc} येथून ${type} आपत्कालीन संदेश आला आहे. शिफारस केलेली मदत: ${agenciesMr}.`,
    ta: `கட்டுப்பாட்டு அறை கவனத்திற்கு. ${loc} இலிருந்து ${type} அவசர அழைப்பு.`,
    te: `కంట్రోల్ రూమ్ దృష్టికి. ${loc} నుండి ${type} అత్యవసర పరిస్థితి.`
  };
}

function makeCaseId(id, meta) {
  const st = (meta.state || "MH").slice(0, 2).toUpperCase();
  const dist = (meta.district || "DST").slice(0, 3).toUpperCase();
  return `${st}-${dist}-${String(id).padStart(4, "0")}`;
}

function findEmergency(id) {
  return emergencies.find(e => e.id === parseInt(id, 10));
}

/* =========================
   API ENDPOINTS
========================= */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  // Simplified logic as per request: admin123 is the key
  if (password !== "admin123") return res.status(401).json({ error: "Invalid password" });

  const token = makeToken();
  const userRole = username === "admin" ? "admin" : "user";
  tokens.set(token, { username: username || "anonymous", role: userRole, createdAt: new Date().toISOString() });

  res.json({ token, role: userRole });
});

app.get("/api/emergencies", authRequired, (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const updates = emergencies.filter(e => e.lastModified > since);
  const sorted = [...updates].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({
    timestamp: Date.now(),
    updates: sorted
  });
});

app.get("/api/volunteers", authRequired, (req, res) => {
  res.json(volunteers);
});

app.post("/api/emergency", (req, res) => {
  const { deviceId, pin, type, coords, severity = "Medium", language = "en", accuracy = null, address = "", channel = "DATA" } = req.body;
  if (!deviceId || !pin || !type || !coords || coords.lat == null || coords.lng == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const device = devices[deviceId];
  if (!device || device.pin !== pin) return res.status(403).json({ error: "Unauthorized device" });

  const now = Date.now();
  const last = lastAlertByDevice.get(deviceId);
  if (last && now - last < COOLDOWN_MS) return res.status(429).json({ error: "Cooldown active" });
  lastAlertByDevice.set(deviceId, now);

  const agencies = routeAgencies(type);
  const priority = priorityFrom(type, severity);
  const meta = { ...device, agencies };

  const e = {
    id: nextId++,
    caseId: "",
    deviceId,
    village: device.village,
    district: device.district,
    state: device.state,
    type,
    severity,
    priority,
    language: String(language).toUpperCase(),
    coords,
    accuracy,
    address,
    channel,
    agenciesAuto: agencies,
    timestamp: new Date().toISOString(),
    lastModified: Date.now(),
    lastLocationUpdate: new Date().toISOString(),
    smartScore: 0,
    status: "Pending",
    dispatchedUnits: [],
    escalatedLevel: 0,
    escalationNotes: "",
    auditLog: [],
    ttsText: {},
    health: req.body.health || { battery: 100, signal: "Unknown" }
  };

  e.smartScore = calculateSmartScore(e);
  e.sopStatus = getDynamicSOPs(type, device, e);
  addToAuditLog(e, "CREATED", "DEVICE_" + deviceId, { channel });
  e.caseId = makeCaseId(e.id, meta);
  e.ttsText = buildTTS(type, { ...meta, address: e.address, agencies });

  if (emergencies.length >= MAX_EMERGENCIES) emergencies.shift();
  emergencies.push(e);

  console.log(`🚨 [NEW ALERT] ID: ${e.caseId} | Type: ${type}`);
  res.status(201).json({
    message: "Emergency received",
    id: e.id,
    caseId: e.caseId,
    ttsText: e.ttsText
  });
});

app.post("/api/emergency/:id/audio", (req, res) => {
  const { id } = req.params;
  const { audioData } = req.body;
  const e = findEmergency(id);
  if (!e) return res.status(404).json({ error: "Not found" });
  e.audioMessage = audioData;
  e.lastModified = Date.now();
  addToAuditLog(e, "VOICE_MESSAGE_RECEIVED", "DEVICE_" + e.deviceId);
  res.json({ success: true });
});

app.patch("/api/emergency/:id/location", (req, res) => {
  const { id } = req.params;
  const { coords, accuracy = null, address = "" } = req.body;
  const e = findEmergency(id);
  if (!e || !coords) return res.status(400).json({ error: "Invalid request" });
  e.coords = coords;
  e.accuracy = accuracy;
  if (address) e.address = address;
  e.lastLocationUpdate = new Date().toISOString();
  e.lastModified = Date.now();
  addToAuditLog(e, "LOCATION_UPDATE", e.deviceId, { accuracy });
  res.json({ success: true });
});

/* ===== Workflow endpoints ===== */
app.post("/api/emergency/:id/ack", authRequired, (req, res) => {
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).json({ error: "Not found" });
  e.status = "Acknowledged";
  addToAuditLog(e, "ACKNOWLEDGED", req.user.username);
  e.lastModified = Date.now();
  res.json({ success: true });
});

app.post("/api/emergency/:id/dispatch", authRequired, (req, res) => {
  const { units } = req.body || {};
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).json({ error: "Not found" });
  e.status = "Dispatched";
  e.dispatchedUnits = (units && units.length) ? units : e.agenciesAuto;
  addToAuditLog(e, "DISPATCHED", req.user.username, { units: e.dispatchedUnits });
  e.lastModified = Date.now();
  res.json({ success: true });
});

app.post("/api/emergency/:id/close", authRequired, (req, res) => {
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).json({ error: "Not found" });
  e.status = "Closed";
  addToAuditLog(e, "CLOSED", req.user.username);
  e.lastModified = Date.now();
  res.json({ success: true });
});

app.post("/api/emergency/:id/false", authRequired, (req, res) => {
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).json({ error: "Not found" });
  e.status = "False";
  addToAuditLog(e, "MARK_FALSE", req.user.username);
  e.lastModified = Date.now();
  res.json({ success: true });
});

app.post("/api/emergency/:id/sop/:sopId", authRequired, (req, res) => {
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).json({ error: "Not found" });
  const sop = e.sopStatus.find(s => s.id === req.params.sopId);
  if (sop) {
    sop.completed = !sop.completed;
    e.lastModified = Date.now();
    addToAuditLog(e, "SOP_UPDATE", req.user.username, { sopId: sop.id, status: sop.completed });
  }
  res.json({ success: true });
});

/* =========================
   REPORTS
========================= */
app.get("/report/:id", authRequired, (req, res) => {
  const e = findEmergency(req.params.id);
  if (!e) return res.status(404).send("Report not found");

  const audit = (e.auditLog || [])
    .map(a => `<tr><td>${a.time}</td><td>${a.action}</td><td>${a.by || ""}</td><td style="font-family:monospace; font-size:9px;">${a.hash ? a.hash.substr(0, 10) + '...' : '-'}</td><td style="font-family:monospace; font-size:7px; color:green;">${a.signature ? 'SIGNED: ' + a.signature.substr(0, 12) + '...' : '-'}</td></tr>`)
    .join("");

  const sopList = (e.sopStatus || [])
    .map(s => `<li>[ ${s.completed ? 'X' : ' '} ] ${s.text}</li>`)
    .join("");

  res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>GOVT COMPLIANT REPORT - ${e.caseId}</title>
  <style>
    body{font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding:40px; color:#111; line-height:1.6;}
    .seal{border:2px solid #000; padding:10px; display:inline-block; font-weight:bold; margin-bottom:20px;}
    h1{margin:0 0 10px; text-transform:uppercase; letter-spacing:1px;}
    .box{border:1px solid #ccc; padding:20px; margin:20px 0; background:#f9f9f9;}
    table{width:100%; border-collapse:collapse; margin-top:10px;}
    th,td{border:1px solid #ddd; padding:10px; font-size:12px; text-align:left;}
    th{background:#eee;}
    .status-ok{color:green; font-weight:bold;}
    .btn{padding:12px 20px; border:none; background:#333; color:#fff; cursor:pointer; border-radius:4px;}
  </style>
</head>
<body>
  <div class="seal">OFFICIAL INCIDENT RECORD - R-SECS</div>
  <h1>Incident Report & Audit Trail</h1>
  <div>Case ID: <b>${e.caseId}</b> | Timestamp: ${e.timestamp}</div>
  <div class="box">
    <h3>Device Compliance Data</h3>
    Status: <span class="status-ok">ACTIVE</span> | Battery: <b>${e.health ? e.health.battery : 100}%</b>
  </div>
  <div class="box">
    <h3>Standard Operating Procedures</h3>
    <ul style="list-style:none; padding:0;">${sopList}</ul>
  </div>
  <div class="box">
    <h3>Audit Timeline</h3>
    <table>
      <thead><tr><th>Time</th><th>Action</th><th>Performer</th><th>Hash</th><th>Digital Sig</th></tr></thead>
      <tbody>${audit}</tbody>
    </table>
  </div>
  <button class="btn" onclick="window.print()">Print / Export</button>
</body>
</html>`);
});

/* =========================
   ESCALATION ENGINE
========================= */
setInterval(() => {
  const now = Date.now();
  emergencies.forEach(e => {
    if (e.status === "Closed" || e.status === "False") return;
    const createdAt = new Date(e.timestamp).getTime();
    const ageSec = (now - createdAt) / 1000;
    if (e.status === "Pending" && ageSec >= ESCALATE_AFTER_SEC && e.escalatedLevel < 1) {
      e.escalatedLevel = 1;
      e.lastModified = Date.now();
      addToAuditLog(e, "ESCALATED_L1", "SYSTEM");
    }
    if ((e.status === "Pending" || e.status === "Acknowledged") && ageSec >= ESCALATE_LEVEL2_SEC && e.escalatedLevel < 2) {
      e.escalatedLevel = 2;
      e.status = "Dispatched";
      e.dispatchedUnits = e.agenciesAuto;
      e.lastModified = Date.now();
      addToAuditLog(e, "AUTO_DISPATCHED", "SYSTEM");
    }
  });
}, 5000);

/* =========================
   STATIC ROUTES
========================= */
app.get("/", (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>R-SECS Gateway</title>
      <style>
        body { font-family: 'Outfit', sans-serif; background: #0a0a0c; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; background: #16161a; padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        h1 { color: #00f2ff; margin-bottom: 30px; }
        .links { display: flex; gap: 20px; justify-content: center; }
        a { text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: bold; transition: 0.3s; }
        .user-link { background: #ff3b30; color: white; }
        .admin-link { background: #00f2ff; color: black; }
        a:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(255,255,255,0.1); }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🇮🇳 R-SECS PROJECT GATEWAY</h1>
        <div class="links">
          <a href="/user" class="user-link">USER INTERFACE</a>
          <a href="/admin" class="admin-link">CONTROL ROOM</a>
        </div>
      </div>
    </body>
    </html>`);
});

app.get("/user", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "user", "index.html"));
});

// Alias for common sub-paths
app.get("/user/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "user", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
