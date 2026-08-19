exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Falta la API Key de Gemini en las variables de entorno.' })
      };
    }

    const data = JSON.parse(event.body || '{}');
    const { texto } = data;

    if (!texto) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'El texto es requerido.' })
      };
    }

    // index.html solo manda { texto } y espera { textoA, textoB } en la respuesta:
    // textoA = corrección ortográfica estricta, textoB = versión mejorada (HTML).
    // Por eso acá pedimos ambas versiones en una sola llamada a Gemini,
    // en vez de depender de un campo "accion" que el frontend nunca envía.
    const prompt = `Actúa como un supervisor experto en cobranzas para Naranja X en Argentina.
Te paso un mensaje escrito por un asesor. Necesito DOS versiones, devueltas EXCLUSIVAMENTE en JSON válido, sin texto adicional ni backticks:

{
  "corregido": "el mismo mensaje, con ortografía, tildes, puntuación y gramática corregidas, sin cambiar el estilo ni el contenido",
  "mejorado": "una reescritura persuasiva, firme pero empática, clara y enfocada en lograr el compromiso de pago, en tono profesional"
}

Mensaje original:
"${texto}"`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const resData = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: resData.error?.message || 'Error en Gemini API.' })
      };
    }

    const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Gemini a veces envuelve el JSON en ```json ... ``` pese a lo pedido: lo limpiamos.
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let corregido = '';
    let mejorado = '';
    try {
      const parsed = JSON.parse(cleaned);
      corregido = (parsed.corregido || '').trim();
      mejorado = (parsed.mejorado || '').trim();
    } catch (parseErr) {
      // Si por algún motivo Gemini no devolvió JSON válido, evitamos romper el frontend:
      // usamos el texto crudo como corrección y dejamos vacía la mejora.
      corregido = rawText.trim() || 'No se pudo procesar el texto.';
    }

    // textoB se pinta con innerHTML en el frontend: la versión mejorada
    // se marca en rojo, tal como describe la interfaz.
    const escapeHtml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const textoB = mejorado
      ? `<span style="color:red;">${escapeHtml(mejorado)}</span>`
      : '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        textoA: corregido,
        textoB: textoB
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno: ' + error.message })
    };
  }
};
