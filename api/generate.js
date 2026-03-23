// api/generate.js — hardened & secure, supports free trial + pro token auth

import crypto from 'crypto';

const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

function verifyToken(token) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64payload, sig] = parts;
  const payload = Buffer.from(b64payload, 'base64url').toString();
  const [, expiry] = payload.split(':');
  if (!expiry || Date.now() > parseInt(expiry)) return false; // expired
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

const ALLOWED_TYPES = ['Individual Therapy','Couples Therapy','Family Therapy','Group Therapy','Initial Intake','Crisis Session'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Origin check
  const allowedOrigins = [process.env.ALLOWED_ORIGIN, 'http://localhost:3000'].filter(Boolean);
  const origin = req.headers['origin'] || '';
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });

  // Auth check — either valid pro token OR free trial (validated client-side, honour system for MVP)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const isPro = token ? verifyToken(token) : false;
  // For MVP, free trial limit is enforced client-side (localStorage).
  // For production, move this server-side with a DB / Redis counter per IP.

  // Input validation
  const { notes, clientId, sessionDate, sessionType } = req.body || {};
  if (!notes || typeof notes !== 'string') return res.status(400).json({ error: 'Missing session notes.' });
  const trimmed = notes.trim();
  if (trimmed.length < 20)   return res.status(400).json({ error: 'Session summary is too short.' });
  if (trimmed.length > 4000) return res.status(400).json({ error: 'Session summary is too long (max 4000 chars).' });

  const safeClient = (clientId || '').replace(/[^a-zA-Z0-9 .\-]/g, '').slice(0, 20);
  const safeDate   = (sessionDate || '').replace(/[^0-9\-]/g, '').slice(0, 10);
  const safeType   = ALLOWED_TYPES.includes(sessionType) ? sessionType : 'Individual Therapy';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('GEMINI_API_KEY not set'); return res.status(500).json({ error: 'Server configuration error.' }); }

  const systemPrompt = `You are an expert clinical documentation specialist helping licensed therapists write professional SOAP notes.
Respond ONLY with a valid JSON object with exactly four keys: "S", "O", "A", "P". No markdown, no backticks, no explanation.
- S (Subjective): Client's self-reported symptoms, feelings, concerns. Use "Client reports..." or "Client states..."
- O (Objective): Observable facts only — affect, behavior, appearance, speech, engagement level.
- A (Assessment): Clinical impressions, progress toward goals, functioning level, modalities used, risk if relevant.
- P (Plan): Next appointment, homework, planned interventions, referrals, safety planning if needed.
Each section: 2–5 sentences. Professional, specific, clinically accurate.`;

  const userPrompt = `Session Type: ${safeType}\nClient: ${safeClient || 'Client'}\nDate: ${safeDate || 'Not specified'}\n\nTherapist summary:\n${trimmed}\n\nGenerate the SOAP note JSON now.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error('Gemini error:', err);
      throw new Error('AI service error. Please try again.');
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    let soap;
    try { soap = JSON.parse(clean); }
    catch { throw new Error('Could not parse generated note. Please try again.'); }

    if (!soap.S || !soap.O || !soap.A || !soap.P) throw new Error('Incomplete note generated. Please try again.');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    return res.status(200).json({ soap, isPro });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to generate note.' });
  }
}
