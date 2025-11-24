// Import required modules
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = require("node-fetch");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static("."));

// Cerebras API Configuration
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
// Use higher-capacity model per user request
const MODEL = "llama-3.3-70b";

// Validate API key on startup
if (!CEREBRAS_API_KEY) {
  console.error("ERROR: CEREBRAS_API_KEY is not set in .env file");
  process.exit(1);
}

/**
 * POST /convert - Convert code from one language to another
 */
app.post("/convert", async (req, res) => {
  try {
    const { sourceCode, targetLanguage } = req.body;

    // Validate request body
    if (!sourceCode || !targetLanguage) {
      return res.status(400).json({
        error:
          "Missing required fields: sourceCode and targetLanguage are required",
      });
    }

    if (typeof sourceCode !== "string" || typeof targetLanguage !== "string") {
      return res.status(400).json({
        error:
          "Invalid data types: sourceCode and targetLanguage must be strings",
      });
    }

    if (sourceCode.trim().length === 0) {
      return res.status(400).json({
        error: "sourceCode cannot be empty",
      });
    }

    // Prepare prompt for Cerebras API
    const prompt = `Convert the following code to ${targetLanguage}. 

RULES:
1. Convert ONLY the code - nothing else
2. If the original code has comments, translate them to English
3. DO NOT add any new comments that weren't in the original code
4. DO NOT add explanations
5. Output ONLY the converted code with NO markdown formatting

Code to convert:
${sourceCode}`;

    // Prepare request payload
    const requestPayload = {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    };

    console.log(`Converting code to ${targetLanguage}...`);

    // Make request to Cerebras API
    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });

    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cerebras API Error:", response.status, errorText);

      return res.status(response.status).json({
        error: `Cerebras API error: ${response.statusText}`,
        details: errorText,
      });
    }

    // Parse response
    const data = await response.json();

    // Extract converted code
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid API response structure:", data);
      return res.status(500).json({
        error: "Invalid response from Cerebras API",
      });
    }

    const convertedCode = data.choices[0].message.content.trim();

    // Clean up the response if it contains markdown code blocks
    const cleanedCode = cleanCodeOutput(convertedCode);

    console.log("Conversion successful");

    // Send response
    res.json({
      output: cleanedCode,
    });
  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Internal server error during code conversion",
      message: error.message,
    });
  }
});

/**
 * POST /explain - Return a plain-language explanation of the provided code
 */
app.post("/explain", async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing required field: code" });
    }

    // Build a prompt that asks the model to explain the code in plain language
    const prompt = `Explain the following ${
      language || "code"
    } in clear, concise plain English. Describe the purpose, major steps, and any important implementation details. Do NOT return code; return explanation only:\n\n${code}`;

    const requestPayload = {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    };

    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Cerebras API Error (explain):",
        response.status,
        errorText
      );
      return res.status(response.status).json({ error: "Cerebras API error" });
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid API response structure (explain):", data);
      return res
        .status(500)
        .json({ error: "Invalid response from Cerebras API" });
    }

    const explanation = data.choices[0].message.content.trim();

    res.json({ explanation });
  } catch (err) {
    console.error("Explain error:", err);
    res.status(500).json({
      error: "Internal server error during explanation",
      message: err.message,
    });
  }
});

/**
 * Clean code output by removing markdown formatting
 * @param {string} code - Code output from API
 * @returns {string} - Cleaned code
 */
function cleanCodeOutput(code) {
  // Remove markdown code blocks
  let cleaned = code.replace(/```[\w]*\n/g, "").replace(/```$/g, "");

  // Remove trailing/leading whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * GET / - Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    model: MODEL,
  });
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    message: err.message,
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("===========================================");
  console.log("Code Converter Server Started");
  console.log("===========================================");
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`API Key configured: ${CEREBRAS_API_KEY ? "Yes" : "No"}`);
  console.log("===========================================");
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});
