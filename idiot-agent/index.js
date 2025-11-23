// ============================================================================
// 💠 1. IMPORTS & INITIAL SETUP
// ============================================================================
import express from "express";
import bodyParser from "body-parser";
import { ChatOllama } from "@langchain/ollama";
import {
  StateGraph,
  END,
  START,
  MessagesAnnotation,
  MemorySaver,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { v4 as uuidv4 } from "uuid";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";
import { base } from "viem/chains";

// ============================================================================
// 💠 2. WALLET CLIENT SETUP
// ============================================================================
const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY1),
});

const walletClient2 = createWalletClient({
  chain: base,
  transport: http(),
  account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY2),
});

// ============================================================================
// 💠 3. CONFIG FUNCTION
// ============================================================================
const config = (data = {}) => {
  return { configurable: { thread_id: uuidv4(), ...data } };
};

// ============================================================================
// 💠 4. MODEL
// ============================================================================
const llm = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0.1,
  maxRetries: 2,
  keepAlive: "24h",
  numCtx: 1024 * 25,
});

// ============================================================================
// 💠 5. SENSOR UTILITY
// ============================================================================
async function fetchIoTSensorHistory(address) {
  let data = null;
  try {
    const ENDPOINT_PATH = `api/sensors/latest?address=${address}`;
    const fetchWithPay = wrapFetchWithPayment(fetch, walletClient);
    const response = await fetchWithPay(
      `${process.env.FETCH_URL}${ENDPOINT_PATH}`,
      {
        method: "GET",
      }
    );
    data = await response.json();
    console.log(data);
  } catch (err) {
    console.log(err);
  }
  return data;
}

async function fetchIoTSensorTop10(address) {
  let data = null;
  try {
    const ENDPOINT_PATH = `api/sensors/latestTop?address=${address}`;
    const fetchWithPay = wrapFetchWithPayment(fetch, walletClient2);
    const response = await fetchWithPay(
      `${process.env.FETCH_URL}${ENDPOINT_PATH}`,
      {
        method: "GET",
      }
    );
    data = await response.json();
    console.log(data);
  } catch (err) {
    console.log(err);
  }
  return data;
}

// ============================================================================
// 💠 6. TOOLS DEFINITIONS
// ============================================================================

function summarizeSensorData(data) {
  if (!data || typeof data !== "object") return "No data";

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  const formatObj = (label, obj) => {
    let section = `${capitalize(label)}:\n`;
    for (const [k, v] of Object.entries(obj)) {
      section += `  ${capitalize(k)}: ${Number(v).toFixed ? Number(v).toFixed(2) : v}\n`;
    }
    return section.trim();
  };

  const parts = [];

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parts.push(formatObj(key, value));
    } else if (typeof value === "number" || typeof value === "string") {
      // Display scalar value; add units if type is known
      let unit = "";
      if (key.toLowerCase().includes("temp")) unit = "°C";
      if (key.toLowerCase().includes("humidity")) unit = "%";
      if (key.toLowerCase().includes("pressure")) unit = "hPa";
      if (key.toLowerCase().includes("tvoc")) unit = " ppb";
      if (key.toLowerCase().includes("eco2")) unit = " ppm";
      parts.push(`${capitalize(key)}: ${Number(value).toFixed ? Number(value).toFixed(2) : value}${unit}`);
    } else if (value == null) {
      parts.push(`${capitalize(key)}: not available`);
    }
  }

  return parts.join("\n\n");
}

const iotSensorTool = tool(
  async ({ address }) => {
    try {
      const result = await fetchIoTSensorHistory(address);
      let sensorDataSummary = "";

      if (result && typeof result === "object" && result.data) {
        sensorDataSummary = summarizeSensorData(result.data);
      } else {
        sensorDataSummary = "No sensor readings found.";
      }

      return JSON.stringify({
        status: "success",
        message: `IoT sensor data: \n\n${sensorDataSummary}`,
        data: result,
      });
    } catch (err) {
      return JSON.stringify({
        status: "error",
        message: `Failed to retrieve sensor data: ${err.message}`,
      });
    }
  },
  {
    name: "fetchIoTSensorData",
    description:
      "Retrieve IoT sensor readings by sensor address using x402 payments. Returns the latest and all data.",
    schema: z.object({
      address: z
        .string()
        .describe("IoT sensor contract or device address (string)."),
    }),
  }
);

const iotSensorTop10Tool = tool(
  async ({ address }) => {
    try {
      const result = await fetchIoTSensorTop10(address);

      if (!result || !result.last || result.last.length === 0) {
        return JSON.stringify({
          status: "error",
          message: "No sensor data found for the last 10 readings.",
        });
      }

      // Analyze the last 10 readings
      const readings = result.last;
      let maxAccelX = -Infinity;
      let maxAccelY = -Infinity;
      let maxAccelZ = -Infinity;
      let hasAbnormalReading = false;

      readings.forEach((reading) => {
        if (reading.data && reading.data.accel) {
          // Convert to numbers, handling strings, ints, and floats
          const x = parseFloat(reading.data.accel.x);
          const y = parseFloat(reading.data.accel.y);
          const z = parseFloat(reading.data.accel.z);
          
          // Skip invalid values (NaN)
          if (isNaN(x) || isNaN(y) || isNaN(z)) {
            return; // Skip this reading
          }
          
          // Track maximum values
          if (x > maxAccelX) maxAccelX = x;
          if (y > maxAccelY) maxAccelY = y;
          if (z > maxAccelZ) maxAccelZ = z;

          // Check if any acceleration value exceeds 3
          if (Math.abs(x) > 3 || Math.abs(y) > 3 || Math.abs(z) > 3) {
            hasAbnormalReading = true;
          }
        }
      });

      // Handle case where no valid readings were found
      if (maxAccelX === -Infinity || maxAccelY === -Infinity || maxAccelZ === -Infinity) {
        return JSON.stringify({
          status: "error",
          message: "No valid accelerometer data found in the last 10 readings.",
        });
      }

      let analysis = `**Last 10 Readings Analysis:**\n\n`;
      analysis += `Maximum Accelerometer Values:\n`;
      analysis += `  X-axis: ${maxAccelX.toFixed(2)}\n`;
      analysis += `  Y-axis: ${maxAccelY.toFixed(2)}\n`;
      analysis += `  Z-axis: ${maxAccelZ.toFixed(2)}\n\n`;

      if (hasAbnormalReading) {
        analysis += `⚠️ **ALERT:** Something isn't normal! Detected abnormal accelerometer readings (values exceeding ±3). This could indicate excessive vibration, impact, or movement that requires attention.`;
      } else {
        analysis += `✓ All accelerometer readings are within normal range (±3).`;
      }

      return JSON.stringify({
        status: "success",
        message: analysis,
        data: {
          maxValues: {
            accelX: maxAccelX,
            accelY: maxAccelY,
            accelZ: maxAccelZ,
          },
          abnormalDetected: hasAbnormalReading,
          readingsCount: readings.length,
        },
      });
    } catch (err) {
      return JSON.stringify({
        status: "error",
        message: `Failed to retrieve top 10 sensor data: ${err.message}`,
      });
    }
  },
  {
    name: "fetchIoTSensorTop10Analysis",
    description:
      "Retrieve and analyze the last 10 IoT sensor readings by address using x402 payments. Returns maximum accelerometer values and detects abnormal readings (values exceeding ±3). Use this tool when users want to check recent sensor history or detect anomalies.",
    schema: z.object({
      address: z
        .string()
        .describe("IoT sensor contract or device address (string)."),
    }),
  }
);


const fallbackTool = tool(
  () => {
    console.log("Fallback Tool invoked.");
    return JSON.stringify({
      status: "info",
      message:
        "As stated above, say something friendly and invite the user to interact with you.",
    });
  },
  {
    name: "fallback",
    description:
      "This tool activates when the user greets the assistant with a simple 'hi' or 'hello' and asks for help. It provides a friendly and welcoming message to initiate the conversation.",
    schema: z.object({}),
  }
);

// ============================================================================
// 💠 7. AGENT UTILS
// ============================================================================
function setInput(input) {
  return {
    messages: [
      {
        role: "system",
        content:
          "Present you like 'I am an idiot agent', a knowledgeable and friendly assistant. Focus on providing insights and guidance across various topics without returning code snippets. Maintain a professional and warm tone, adapting responses to suit user needs.",
      },
      {
        role: "user",
        content: input,
      },
    ],
  };
}

// List of tools for the workflow
const all_api_tools = [fallbackTool, iotSensorTool, iotSensorTop10Tool];
const tools_node = new ToolNode(all_api_tools);
const llm_with_tools = llm.bindTools(all_api_tools);

// Model node for the agent graph
const call_model = async (state) => {
  console.log("Model Node");
  const response = await llm_with_tools.invoke(state.messages);
  return { messages: response };
};

// Decides the next step based on tool calls
function shouldContinue(state) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  console.log("Last message tool calls:", lastMessage["tool_calls"]);
  if (lastMessage["tool_calls"] && lastMessage["tool_calls"].length > 0) {
    return "tool";
  } else {
    return END;
  }
}

// ============================================================================
// 💠 8. SINGLE-STEP DIRECT RESPONSE WORKFLOW
// ============================================================================
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", call_model)
  .addNode("tool", tools_node)
  .addNode("end", (state) => state)
  .addConditionalEdges("model", shouldContinue, { tool: "tool", end: "end" })
  .addEdge(START, "model")
  .addEdge("tool", "end");

// ============================================================================
// 💠 9. MEMORY AND GRAPH COMPILATION
// ============================================================================
const memory = new MemorySaver();
const graph = workflow.compile({ checkpointer: memory });

// ============================================================================
// 💠 10. AGENT INVOKER (DIRECT RESPONSE)
// ============================================================================
async function invokeAgent(message, contextData) {
  const input = setInput(message);
  const context = config(contextData);
  const output = await graph.invoke(input, context);
  // Return the final tool or model message, parsed/cleaned
  const toolMsgs = output.messages.filter((m) => m.content && m.name);
  if (toolMsgs.length > 0) {
    try {
      return JSON.parse(toolMsgs[toolMsgs.length - 1].content);
    } catch {
      return { status: "success", message: toolMsgs[toolMsgs.length - 1].content };
    }
  }
  return { status: "success", message: output.messages[output.messages.length - 1].content };
}

// ============================================================================
// 💠 11. EXPRESS SERVER API
// ============================================================================
const app = express();
const port = process.env.PORT || 8000;

// Middleware to parse JSON body
app.use(bodyParser.json());

// Middleware for API Key authentication
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.AI_URL_API_KEY) {
    console.warn("Unauthorized access attempt: Invalid or missing X-API-Key");
    return res.status(401).json({
      status: "error",
      message: "Unauthorized: Invalid or missing API Key.",
    });
  }
  next();
});

// Main API endpoint to interact with the agent
app.post("/api/chat", async (req, res) => {
  const { message, context } = req.body;
  console.log("Received message:", message);
  console.log("Received context:", context);
  const contextData = context || {};
  const agentResponse = await invokeAgent(message, contextData);
  res.status(200).json(agentResponse);
});

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "I.D.I.O.T API is running." });
});

// Start the server
app.listen(port, () => {
  console.log(`I.D.I.O.T API listening at http://localhost:${port}`);
});

// ============================================================================
// 💠 12. HEALTH CHECKER
// ============================================================================

function checkHealth() {
  fetch(process.env.PERMANENT_URL, {
    headers: {
      "x-api-key": process.env.AI_URL_API_KEY,
    },
  }).then(async (response) => {
    console.log("API health result:");
    if (response.ok) {
      console.log("API health ok");
      const result = await llm.invoke("Hi there!");
      console.log("Agent health result:");
      console.log(result.content);
    } else {
      console.error("API health error");
    }
  });
}

checkHealth();
setInterval(() => {
  checkHealth();
}, 60 * 60 * 1000 * 0.5); // Every 30 minutes
