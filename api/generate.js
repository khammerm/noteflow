// api/generate.js
// Vercel serverless function — keeps your Gemini API key secret on the backend

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { notes, clientId, sessionDate, sessionType } = req.body;

  if (!notes || notes.trim().length < 10) {
    return res.status(400).json({ error: 'Session summary is too short.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const systemPrompt = `You are an expert clinical documentation specialist helping licensed therapists write professional SOAP notes.
Write clear, concise, and clinically appropriate SOAP notes based on the therapist's session summary.

Respond ONLY with a valid JSON object with exactly these four keys: "S", "O", "A", "P"
No markdown, no backticks, no explanation — just the raw JSON object.

Guidelines:
- S (Subjective): Client's self-reported symptoms, feelings, concerns. Use "Client reports..." or "Client states..."
- O (Objective): Observable facts — therapist's clinical observations of affect, behavior, appearance, speech, engagement. No subjective reports here.
- A (Assessment): Clinical impressions, progress toward treatment goals, functioning level, risk assessment if relevant, therapeutic modalities used.
- P (Plan): Next appointment, homework assigned, interventions planned, referrals, safety planning if needed.

Each section: 2-5 sentences. Be specific, professional, and clinically accurate.`;

  const userPrompt = `Session Type: ${sessionType || 'Individual Therapy'}
Client: ${clientId || 'Client'}
Date: ${sessionDate || new Date().toLocaleDateString()}

Therapist's session summary:
${notes}

Generate the SOAP note JSON now.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Gemini API error ${response.status}`);
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const soap = JSON.parse(clean);

    // Validate we got all 4 sections
    if (!soap.S || !soap.O || !soap.A || !soap.P) {
      throw new Error('Incomplete SOAP note generated. Please try again.');
    }

    return res.status(200).json({ soap });

  } catch (err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to generate note.' });
  }
}
