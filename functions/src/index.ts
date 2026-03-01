/**
 * Firebase Cloud Functions for myfynzo
 * 
 * fynzoPulse — AI financial advisor powered by Anthropic Claude
 * 
 * SETUP:
 * 1. cd functions && npm install
 * 2. Set Anthropic API key in Firestore: system/api_keys → anthropicKey
 *    OR use Firebase environment config: firebase functions:config:set anthropic.key="sk-ant-..."
 * 3. firebase deploy --only functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ─── Rate limiting: 30 messages/day per user ───
async function checkRateLimit(uid: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]; // "2026-03-01"
  const ref = db.doc(`users/${uid}/pulse_limits/${today}`);
  const snap = await ref.get();
  const count = snap.exists ? (snap.data()?.count || 0) : 0;
  if (count >= 30) return false;
  await ref.set({ count: count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return true;
}

// ─── Get Anthropic API key from Firestore or config ───
async function getAnthropicKey(): Promise<string | null> {
  // Try Firestore first (preferred — can be updated without redeploying)
  try {
    const snap = await db.doc("system/api_keys").get();
    if (snap.exists) {
      const key = snap.data()?.anthropicKey;
      if (key && typeof key === "string" && key.startsWith("sk-ant-")) return key;
    }
  } catch {}

  // Fallback: Firebase config
  try {
    const config = functions.config();
    if (config?.anthropic?.key) return config.anthropic.key;
  } catch {}

  return null;
}

// ─── System prompt for the financial advisor ───
function buildSystemPrompt(financialContext: string, currency: string): string {
  return `You are fynzo Intelligence, an expert AI financial advisor built into the myfynzo wealth management platform.

ROLE & TONE:
- You are a trusted, knowledgeable financial advisor — warm but professional
- Give specific, actionable advice based on the user's real financial data
- Use clear numbers and percentages when analyzing their portfolio
- Be direct about risks and opportunities
- Never use generic advice when you have specific data to reference
- Format responses with **bold** for key numbers and use bullet points for lists
- Keep responses concise (2-4 paragraphs max) unless the question needs depth

IMPORTANT BOUNDARIES:
- You are NOT a licensed financial advisor — always note this when giving specific investment recommendations
- Do not recommend specific securities unless discussing what the user already owns
- For tax advice, note that rules vary by jurisdiction and suggest consulting a professional
- Currency: ${currency}

USER'S FINANCIAL DATA:
${financialContext}

Use this data to give personalized, specific answers. Reference actual holdings, amounts, and percentages from their portfolio.`;
}

// ─── Main Cloud Function ───
export const fynzoPulse = functions
  .region("europe-west1") // EU data residency
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;

    // Check premium status
    const userSnap = await db.doc(`users/${uid}`).get();
    const tier = userSnap.data()?.tier || "free";
    if (tier === "free") {
      throw new functions.https.HttpsError("permission-denied", "Premium subscription required.");
    }

    // Rate limit
    const allowed = await checkRateLimit(uid);
    if (!allowed) {
      throw new functions.https.HttpsError("resource-exhausted", "Daily message limit reached (30/day).");
    }

    // Get API key
    const apiKey = await getAnthropicKey();
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "AI service not configured. Set Anthropic API key in Firestore (system/api_keys → anthropicKey)."
      );
    }

    // Build messages
    const { messages, financialContext, currency, locale } = data;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "Messages array is required.");
    }

    const systemPrompt = buildSystemPrompt(financialContext || "No financial data available.", currency || "EUR");

    // Call Anthropic Claude API
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.slice(-10).map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Anthropic API error:", response.status, errorBody);
        throw new functions.https.HttpsError("internal", "AI service returned an error.");
      }

      const result = await response.json();
      const responseText = result.content?.[0]?.text || "I couldn't process that. Please try again.";

      return { response: responseText };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error("fynzoPulse error:", err);
      throw new functions.https.HttpsError("internal", "Failed to get AI response.");
    }
  });
