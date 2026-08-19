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
        body: JSON.stringify({ error: 'El texto del audio/mensaje es requerido.' })
      };
    }

    const prompt = `Actúa como un asesor telefónico/digital experto en cobranzas para Naranja X en Argentina.
Toma la siguiente transcripción de nota de voz o resumen de conversación y redacta un mensaje de WhatsApp / SMS perfecto para enviar al cliente.
Normas de redacción:
- Mantén la empresa "AGENCIA DE COBRANZAS SUIVANT" o "Naranja X" si corresponde.
- Tono profesional, claro, directo y enfocado en regularizar la deuda.
- Incluye llamado a la acción claro.

Transcripción / Ideas:
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

    const resultadoTexto = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el mensaje.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ texto: resultadoTexto.trim() })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno: ' + error.message })
    };
  }
};
