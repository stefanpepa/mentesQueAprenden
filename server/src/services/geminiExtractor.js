const OpenAI = require('openai');
const { PDFParse } = require('pdf-parse');

// Cliente separado del de ia.js: mismo proveedor (OpenRouter) pero con un
// único propósito — extraer texto crudo de un documento, sin interpretarlo.
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
    'X-Title': 'Centro de Salud Interdisciplinario'
  }
});

// Dos modelos Google (únicos con soporte de PDF nativo en el tier gratuito de
// OpenRouter) — si el primero está saturado (429), se prueba el segundo antes
// de reintentar el primero de nuevo. Solo se usan como fallback: si el PDF
// tiene texto nativo, se extrae localmente con pdf-parse y no hace falta IA.
const MODELOS_EXTRACCION = ['google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free'];
const REINTENTOS = 3;
const ESPERA_MS = 3000;

// Un PDF escaneado (imagen sin capa de texto) da muy pocos caracteres al
// extraerlo localmente — por debajo de esto, se considera "sin texto útil"
// y se cae al OCR por IA.
const MIN_CARACTERES_TEXTO_NATIVO = 40;

const PROMPT_EXTRACCION = `Sos un extractor de texto (OCR), no un asistente clínico.
Tu única tarea es transcribir literalmente todo el contenido visible del documento: texto, tablas, encabezados, fechas, firmas, números.
No interpretes, no resumas, no opines, no completes información faltante, no expliques qué es el documento.
Si hay tablas, transcribilas en formato de texto plano legible (filas y columnas separadas claramente).
Si una parte no se puede leer, escribí [ilegible] en ese punto y seguí con el resto.
Devolvé solo la transcripción, sin comentarios tuyos antes o después.`;

// Intenta extraer el texto nativo del PDF localmente (sin IA). Devuelve null
// si falla el parseo o si el resultado es demasiado corto (PDF escaneado).
async function extraerTextoNativoPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText();
    const limpio = (text || '').trim();
    if (limpio.length < MIN_CARACTERES_TEXTO_NATIVO) return null;
    return limpio;
  } catch {
    return null;
  } finally {
    await parser.destroy();
  }
}

// Gemini (vía OpenRouter) solo acepta URLs directas para PNG/JPEG/WebP/GIF.
// Para PDF (y cualquier otro formato) exige un data: URL en base64.
async function resolverUrlParaGemini(signedUrl, mimeType) {
  const formatosDirectos = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (formatosDirectos.includes(mimeType)) return signedUrl;

  const resp = await fetch(signedUrl);
  if (!resp.ok) throw new Error('No se pudo descargar el archivo para procesarlo');
  const buffer = Buffer.from(await resp.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// OCR por IA — solo se usa cuando no hay texto nativo disponible (PDF
// escaneado o imagen). Los modelos gratuitos de OpenRouter suelen dar 429
// por saturación del pool compartido — se reintenta alternando modelos.
async function extraerTextoConIA(signedUrl, nombreArchivo, mimeType) {
  const urlParaGemini = await resolverUrlParaGemini(signedUrl, mimeType);

  let ultimoError;
  for (let intento = 0; intento < REINTENTOS; intento++) {
    const modelo = MODELOS_EXTRACCION[intento % MODELOS_EXTRACCION.length];
    try {
      const res = await openrouter.chat.completions.create({
        model: modelo,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${PROMPT_EXTRACCION}\n\nDocumento: ${nombreArchivo}` },
              { type: 'image_url', image_url: { url: urlParaGemini } }
            ]
          }
        ]
      });
      return res.choices[0].message.content.trim();
    } catch (err) {
      ultimoError = err;
      const esRateLimit = err.status === 429;
      if (!esRateLimit || intento === REINTENTOS - 1) throw err;
      await esperar(ESPERA_MS);
    }
  }
  throw ultimoError;
}

// Extrae el texto crudo de un PDF o imagen accesible por URL firmada.
// No hace ningún tipo de análisis clínico — eso queda para la etapa siguiente.
// Para PDF con texto nativo (la mayoría de informes digitales), se extrae
// localmente sin depender de ningún modelo de IA. Solo cae a OCR por IA si
// el PDF es escaneado o si el archivo es directamente una imagen.
async function extraerTextoDocumento(signedUrl, nombreArchivo, mimeType) {
  if (mimeType === 'application/pdf') {
    const resp = await fetch(signedUrl);
    if (!resp.ok) throw new Error('No se pudo descargar el archivo para procesarlo');
    const buffer = Buffer.from(await resp.arrayBuffer());

    const textoNativo = await extraerTextoNativoPdf(buffer);
    if (textoNativo) return textoNativo;
    // PDF sin capa de texto (escaneado) — cae a OCR por IA.
  }

  return extraerTextoConIA(signedUrl, nombreArchivo, mimeType);
}

module.exports = { extraerTextoDocumento };
