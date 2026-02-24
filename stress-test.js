// Native fetch is available in Node 18+

const API_URL = 'http://localhost:5002/api/emergency';
const TOTAL_ALERTS = 500;

async function sendAlert(i) {
    const payload = {
        deviceId: ["RSECS-001", "RSECS-002", "RSECS-003"][i % 3], // Rotate valid devices
        pin: ["1234", "4321", "1111"][i % 3],
        type: ["Medical", "Fire", "Crime", "Disaster"][i % 4],
        severity: i % 10 === 0 ? "High" : "Medium",
        coords: {
            lat: 19.0 + (Math.random() * 2),
            lng: 73.0 + (Math.random() * 2)
        },
        address: `Simulation Village ${i}, Dist ${i}`,
        channel: "SIMULATION"
    };

    try {
        const start = Date.now();
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`[${i}] Status: ${res.status} | Time: ${Date.now() - start}ms`);
    } catch (e) {
        console.error(`[${i}] FAILED:`, e.message);
    }
}

async function run() {
    console.log(`Starting Stress Test: ${TOTAL_ALERTS} alerts...`);
    const batchSize = 50;
    for (let i = 0; i < TOTAL_ALERTS; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < TOTAL_ALERTS; j++) {
            batch.push(sendAlert(i + j));
        }
        await Promise.all(batch);
        console.log(`Batch ${i}-${i + batchSize} done.`);
    }
    console.log("Stress Test Complete");
}

run();
