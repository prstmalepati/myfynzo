// =============================================================
// functions/src/fynzoPulse.ts
// AI Financial Advisor — Cloud Function
// Uses Anthropic Claude API for personalized financial advice
// =============================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SYSTEM_PROMPT = `You are fynzo Intelligence, an AI-powered personal financial advisor built into the myfynzo wealth management platform. You provide personalized, actionable financial guidance based on the user's real financial data.

CORE PRINCIPLES:
- You have access to the user's complete financial snapshot (portfolio, expenses, debts, goals, projections)
- Give specific, data-driven advice referencing their actual numbers
- Be concise but thorough — prioritize actionable next steps
- Use the user's currency when discussing amounts
- Always caveat that you provide informational guidance, not licensed financial advice
- Be encouraging but honest — flag risks and concerns directly
- For tax advice, reference the user's country-specific rules (India: 80C/80D/new vs old regime; Germany: Abgeltungssteuer/Kirchensteuer/Freistellungsauftrag)

CAPABILITIES:
- Portfolio analysis: allocation review, concentration risk, sector exposure
- Investment advice: asset allocation suggestions, rebalancing opportunities
- Debt optimization: payoff strategies, refinancing opportunities
- Tax optimization: country-specific tax-saving strategies
- Goal tracking: progress assessment, timeline feasibility
- FIRE planning: savings rate analysis, timeline projection
- Budget insights: spending pattern analysis, savings opportunities
- Risk assessment: portfolio risk evaluation, emergency fund adequacy

FORMAT:
- Use **bold** for key numbers and important points
- Use bullet points for actionable items
- Keep responses focused and under 400 words
- End with 1-2 specific action items when relevant`;

interface PulseRequest {
  messages: { role: string; content: string }[];
  financialContext: string;
  currency: string;
  locale: string;
}

export const fynzoPulse = functions.https.onCall(async (data: PulseRequest, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.HttpsError('unauthenticated', 'Must be logged in');
  }

  const uid = context.auth.uid;

  // Premium check
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.HttpsError('not-found', 'User not found');
  }
  const userData = userDoc.data()!;
  const tier = userData.tier || 'free';
  if (tier === 'free') {
    throw new functions.HttpsError('permission-denied', 'Premium subscription required for fynzo Intelligence');
  }

  // Rate limiting: 30 messages/day
  const today = new Date().toISOString().split('T')[0];
  const rateLimitRef = db.collection('users').doc(uid).collection('rateLimit').doc(`pulse_${today}`);
  const rateLimitDoc = await rateLimitRef.get();
  const messageCount = rateLimitDoc.exists ? (rateLimitDoc.data()!.count || 0) : 0;
  if (messageCount >= 30) {
    throw new functions.HttpsError('resource-exhausted', 'Daily message limit reached (30/day). Resets at midnight.');
  }

  // Get API key
  const apiKeysDoc = await db.collection('system').doc('api_keys').get();
  if (!apiKeysDoc.exists || !apiKeysDoc.data()!.anthropicKey) {
    throw new functions.HttpsError('failed-precondition', 'AI service not configured. Admin needs to set the Anthropic API key.');
  }
  const anthropicKey = apiKeysDoc.data()!.anthropicKey;

  // Build messages for Claude
  const systemMessage = `${SYSTEM_PROMPT}\n\n${data.financialContext}`;

  const claudeMessages = data.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemMessage,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[fynzoPulse] Anthropic API error:', response.status, errText);
      throw new functions.HttpsError('internal', 'AI service temporarily unavailable');
    }

    const result = await response.json();
    const responseText = result.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n') || '';

    // Update rate limit
    await rateLimitRef.set({
      count: messageCount + 1,
      date: today,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log usage for analytics
    await db.collection('users').doc(uid).collection('pulseHistory').add({
      userMessage: data.messages[data.messages.length - 1]?.content || '',
      responseLength: responseText.length,
      model: 'claude-sonnet-4-5-20250929',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { response: responseText };
  } catch (err: any) {
    if (err instanceof functions.HttpsError) throw err;
    console.error('[fynzoPulse] Error:', err);
    throw new functions.HttpsError('internal', 'AI service error. Please try again.');
  }
});
