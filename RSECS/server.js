const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   AUTH MECHANISM (Operator Only)
========================= */
const OPERATOR_USER = { username: "operator1", password: "op123", role: "OPERATOR" };
const SESSIONS = new Map(); // token -> {username, role, createdAt}

function makeToken() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

app.post("/api/login", (req, res) => {
    const { username, password } = req.body || {};

    if (username === OPERATOR_USER.username && password === OPERATOR_USER.password) {
        const token = makeToken();
        SESSIONS.set(token, { username, role: OPERATOR_USER.role, createdAt: Date.now() });
        return res.json({ token, username, role: OPERATOR_USER.role });
    }

    res.status(401).json({ error: "Invalid operator credentials" });
});

function requireOperator(req, res, next) {
    const token = req.headers["x-auth-token"];
    const session = token ? SESSIONS.get(token) : null;
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    req.user = session;
    next();
}

/* =========================
   EMERGENCY DATA STORE
========================= */
let emergencies = [];
let nextId = 1;

/* =========================
   API ENDPOINTS
========================= */

// Device/User UI: Send alert (No Auth)
app.post("/api/emergency", (req, res) => {
    const { type, coords, address, deviceId, language, pinOk } = req.body || {};

    if (!type || !coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
        return res.status(400).json({ error: "Invalid data. type and coords required." });
    }

    const newEmergency = {
        id: nextId++,
        type,
        coords,
        address: address || "",
        deviceId: deviceId || "RSEC-PROTOTYPE-001",
        language: language || "en",
        pinOk: pinOk !== false, // default true
        timestamp: new Date().toISOString(),
        status: "Pending", // Pending, Dispatched
        dispatchedUnits: []
    };

    emergencies.push(newEmergency);
    console.log(`🚨 [ALERT] ${newEmergency.id}: ${type} at ${newEmergency.timestamp}`);

    res.status(201).json({ message: "Emergency received", id: newEmergency.id });
});

// Device: Update location
app.patch("/api/emergency/:id/location", (req, res) => {
    const id = parseInt(req.params.id);
    const { coords, address } = req.body || {};

    const emergency = emergencies.find(e => e.id === id);
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
        emergency.coords = coords;
    }
    if (address) emergency.address = address;

    res.json({ message: "Location updated" });
});

// Control Room: Get alerts (Operator Only)
app.get("/api/emergencies", requireOperator, (req, res) => {
    const sorted = [...emergencies].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sorted);
});

// Control Room: Dispatch (Operator Only)
app.post("/api/emergency/:id/dispatch", requireOperator, (req, res) => {
    const id = parseInt(req.params.id);
    const { units } = req.body || {};

    const emergency = emergencies.find(e => e.id === id);
    if (!emergency) return res.status(404).json({ error: "Emergency not found" });

    emergency.status = "Dispatched";
    emergency.dispatchedUnits = Array.isArray(units) ? units : [];

    console.log(`✅ [DISPATCH] ${id} by ${req.user.username}: Units [${emergency.dispatchedUnits.join(", ")}]`);

    res.json({ message: "Dispatch updated", emergency });
});

// Health Check
app.get("/api/ping", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
    console.log(`
  🚀 R-SECS PROTOTYPE ONLINE
  --------------------------------------------------
  ✅ Server running: http://localhost:${PORT}
  ✅ User UI:        http://localhost:${PORT}/user/index.html
  ✅ Admin Console:  http://localhost:${PORT}/control-room/login.html
  --------------------------------------------------
  Demo Credentials:  operator1 / op123
  `);
});
