export default async function handler(req, res) {

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', 'https://pos-proto.vercel.app');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
  
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured in Vercel environment variables.' });
    }
  
    try {
      const { backlogSummary, ticketsSummary } = req.body;
  
      const prompt = `Eres un experto en Product Management analizando datos reales de Bold POS, un sistema de punto de venta colombiano.
  
  Aquí están los datos actuales del producto:
  
  === BACKLOG DE FEATURES ===
  ${backlogSummary}
  
  === TICKETS DE SOPORTE ===
  ${ticketsSummary}
  
  Analiza estos datos y devuelve un JSON con exactamente esta estructura (sin texto adicional, sin markdown, solo el JSON):
  
  {
    "resumenEjecutivo": "2-3 oraciones resumiendo el estado actual del producto y el insight más importante que ves",
    "alertasCriticas": [
      {
        "titulo": "título corto de la alerta",
        "descripcion": "explicación específica con datos concretos de por qué esto es crítico ahora",
        "tipo": "critica" 
      }
    ],
    "insightsCorrelacion": [
      {
        "titulo": "título del insight",
        "descripcion": "patrón no obvio que encontraste cruzando backlog y tickets",
        "impacto": "alto"
      }
    ],
    "recomendacionesRoadmap": [
      {
        "feature": "nombre de la feature",
        "justificacion": "por qué esta feature debe estar primero en el roadmap, con datos específicos",
        "trimestre": "Q1"
      }
    ],
    "oportunidadesNoVistas": [
      {
        "titulo": "título de la oportunidad",
        "descripcion": "oportunidad estratégica que los datos sugieren y que probablemente no está siendo considerada"
      }
    ]
  }
  
  Reglas:
  - alertasCriticas: máximo 3, solo las más urgentes. tipo puede ser "critica", "advertencia" o "info"
  - insightsCorrelacion: máximo 4, enfocados en patrones que cruzan backlog Y tickets
  - recomendacionesRoadmap: máximo 5, ordenados por prioridad real. trimestre: Q1, Q2, Q3 o Q4
  - oportunidadesNoVistas: máximo 3, las más estratégicas
  - impacto puede ser: "alto", "medio" o "bajo"
  - Usa datos concretos (números, nombres de módulos, porcentajes) en las descripciones
  - No repitas lo obvio, busca patrones no evidentes
  - Responde en español colombiano`;
  
      const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  
      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `Anthropic API error: ${err}` });
      }
  
      const data = await response.json();
      const raw = data.content[0].text.trim();
  
      // Strip markdown fences if model wraps in ```json
      const clean = raw.replace(/^```json\s*/i, '').replace(/```$/,'').trim();
      const parsed = JSON.parse(clean);
  
      res.setHeader('Access-Control-Allow-Origin', 'https://pos-proto.vercel.app');
      return res.status(200).json(parsed);
  
    } catch (err) {
      console.error('ai-insights error:', err);
      return res.status(500).json({ error: err.message });
    }
  }