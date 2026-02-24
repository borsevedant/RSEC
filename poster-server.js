const express = require("express");
const path = require("path");

const app = express();
const PORT = 5003;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve the poster at the root of port 5003
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "poster.html"));
});

app.listen(PORT, () => {
    console.log(`\n🚀 R-SECS Poster Server running at http://localhost:${PORT}`);
    console.log(`This server is isolated from the main device operations for safety.\n`);
});
