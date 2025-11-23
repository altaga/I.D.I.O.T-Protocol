// ===================================================================
// 1. IMPORTS
// ===================================================================
const express = require("express");
const cors = require("cors");
const { paymentMiddleware } = require("x402-express");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const { facilitator } = require("@coinbase/x402");
require("dotenv").config();

// ===================================================================
// 2. CONFIGURATION & SETUP
// ===================================================================
const API_PORT = 3000;
const DB_FILE = "/home/ubuntu/server/db.json";
// ⚠️ REPLACE this with your actual wallet address to receive payments!
const RECEIVING_ADDRESS = "0x5c2aec641952fb009aa879d411f13f274362e7ea";

// ===================================================================
// 3. X402 ROUTE CONFIGURATION (Pricing & Metadata)
// ===================================================================
const x402RouteConfigs = {
  "GET /api/sensors/latest": {
    price: "$0.001",
    network: "base",
    config: {
      description:
        "Retrieve only the latest reading for a specific sensor address.",
      inputSchema: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
  "GET /api/sensors/latestTop": {
    price: "$0.005",
    network: "base",
    config: {
      description:
        "Retrieve the 10 latest reading for a specific sensor address.",
      inputSchema: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
};

// ===================================================================
// 4. EXPRESS APP & MIDDLEWARE SETUP
// ===================================================================
const app = express();

// --- Standard Middleware ---
app.use(cors());
app.use(express.json());

// --- X402 Payment Middleware (Applied globally before routes) ---
app.use(paymentMiddleware(RECEIVING_ADDRESS, x402RouteConfigs, facilitator));

// ===================================================================
// 5. ROUTE DEFINITIONS
// ===================================================================

// --- PUBLIC ROUTE: List all unique sensor addresses (Free) ---
app.get("/api/sensors", (req, res) => {
  const adapter = new FileSync(DB_FILE);
  const db = low(adapter);
  const query = req.query;
  console.log(query);
  try {
    const sensorAddresses = db.get("sensors").keys().value();
    console.log(sensorAddresses);
    return res.status(200).json(sensorAddresses);
  } catch (error) {
    console.error("Error fetching all sensor data:", error);
    return res.status(500).json({ error: "Failed to retrieve sensor list" });
  }
});

app.post("/api/sensors", (req, res) => {
  const adapter = new FileSync(DB_FILE);
  const db = low(adapter);
  const { address, name, description, data } = req.body;
  const timestamp = Date.now();

  console.log("[API] New sensor reading:", {
    address,
    name,
    description,
    data,
    timestamp,
  });

  // Basic validation for required fields
  if (!address || !name || !data) {
    return res.status(400).json({
      error: "Missing required fields: address, name, timestamp, or data.",
    });
  }

  // Initialize array for sensor if missing
  if (!db.has(`sensors.${address}`).value()) {
    db.set(`sensors.${address}`, []).write();
  }

  // Save a new record
  db.get(`sensors.${address}`)
    .push({
      timestamp,
      name,
      description: description || "No description",
      data,
    })
    .write();

  return res.status(200).json({ status: "success" });
});

// --- PROTECTED ROUTE B: Get only the most recent data point (Uses ?address=QUERY) ---
app.get("/api/sensors/latest", (req, res) => {
  const adapter = new FileSync(DB_FILE);
  const db = low(adapter);
  const address = req.query.address;
  console.log(address);

  if (!address) {
    return res
      .status(400)
      .json({ error: "Missing 'address' query parameter." });
  }

  const sensorData = db.get(`sensors.${address}`).value();

  if (!sensorData || sensorData.length === 0) {
    return res.status(404).json({
      error: `Sensor with address ${address} not found or has no data.`,
    });
  } // Get the last element of the history array

  const latestReading = sensorData[sensorData.length - 1]; // 🔑 CHANGE: Wrap the output inside the 'report' object

  return res.status(200).json({
    ...latestReading,
  });
});

app.get("/api/sensors/latestTop", (req, res) => {
  const adapter = new FileSync(DB_FILE);
  const db = low(adapter);
  const address = req.query.address;
  console.log(address);

  if (!address) {
    return res
      .status(400)
      .json({ error: "Missing 'address' query parameter." });
  }

  const sensorData = db.get(`sensors.${address}`).value();

  if (!sensorData || sensorData.length === 0) {
    return res.status(404).json({
      error: `Sensor with address ${address} not found or has no data.`,
    });
  } // Get the last element of the history array

  const last10 = sensorData.slice(-10); // 🔑 CHANGE: Wrap the output inside the 'report' object

  return res.status(200).json({
    last: last10,
  });
});

// ===================================================================
// 6. SERVER START
// ===================================================================
app.listen(API_PORT, () => {
  console.log(`[API] 🌐 Express API listening on http://localhost:${API_PORT}`);
  console.log(
    `[API] Public list route: http://localhost:${API_PORT}/api/sensors`
  );
  console.log(
    `[API] Protected route example: http://localhost:${API_PORT}/api/sensors/history?address=0x...`
  );
});
