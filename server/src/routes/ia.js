const express = require('express');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

// Cliente único OpenRouter — compatible con API de OpenAI
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
    'X-Title': 'Centro de Salud Interdisciplinario'
  }
});

const MODELO_TEXTO = 'google/gemma-4-26b-a4b-it:free';
const MODELO_PDF   = 'google/gemma-4-26b-a4b-it:free';
const MODELO_CHAT  = 'google/gemma-4-26b-a4b-it:free';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function calcularEdad(fechaNac) {
  if (!fechaNac) return '?';
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy.getMonth() < nac.getMonth() ||
     (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

async function completar(modelo, mensajes, maxTokens = 500) {
  const res = await openrouter.chat.completions.create({
    model: modelo,
    max_tokens: maxTokens,
    messages: mensajes
  });
  return res.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────────────────────
// POST /ia/sugerir-notas  — Owl Alpha
// Completa notas parciales del profesional con contexto del paciente
// ─────────────────────────────────────────────────────────────
router.post('/sugerir-notas',
  requireAuth,
  [
    body('notas_parciales').isString().notEmpty(),
    body('paciente_id').isUUID(),
    body('tipo_sesion').isString(),
    body('especialidad').isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { notas_parciales, paciente_id, tipo_sesion, especialidad, sesion_id } = req.body;

    const [{ data: paciente }, { data: anteriores }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('fecha_nacimiento, motivo_consulta').eq('id', paciente_id).single(),
      supabaseAdmin.from('sesiones').select('fecha, tipo, resumen_ia, notas_libres').eq('paciente_id', paciente_id).order('fecha', { ascending: false }).limit(3)
    ]);

    const edad = calcularEdad(paciente?.fecha_nacimiento);
    const historial = anteriores?.length
      ? anteriores.map(s => `- ${new Date(s.fecha).toLocaleDateString('es-AR')}: ${s.resumen_ia || s.notas_libres?.slice(0, 150) || 'sin notas'}`).join('\n')
      : 'Primera sesión.';

    const prompt = `Sos un asistente especializado en ${especialidad} para profesionales de la salud en Argentina.

Paciente: ${edad} años. Motivo: ${paciente?.motivo_consulta || 'no registrado'}.
Sesiones anteriores:\n${historial}

El profesional registró estas notas parciales de una sesión de tipo "${tipo_sesion}":
"${notas_parciales}"

Completá y estructurá las notas en primera persona del profesional. Incluí: observaciones clínicas, intervenciones realizadas, respuesta del paciente, y aspectos a trabajar. Máximo 300 palabras, lenguaje clínico de ${especialidad} en Argentina. Solo las notas, sin títulos.`;

    try {
      const sugerencia = await completar(MODELO_TEXTO, [{ role: 'user', content: prompt }]);
      res.json({ sugerencia });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al conectar con la IA de texto' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /ia/resumir-sesion  — Owl Alpha
// Genera resumen de 3 oraciones para el historial
// ─────────────────────────────────────────────────────────────
router.post('/resumir-sesion',
  requireAuth,
  [
    body('sesion_id').isUUID(),
    body('notas_libres').isString().notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { sesion_id, notas_libres } = req.body;

    const { data: sesion } = await supabaseAdmin
      .from('sesiones')
      .select('tipo, paciente:pacientes(fecha_nacimiento), profesional:profesionales!profesional_id(especialidad)')
      .eq('id', sesion_id)
      .single();

    const edad = calcularEdad(sesion?.paciente?.fecha_nacimiento);
    const especialidad = sesion?.profesional?.especialidad || 'salud';

    const prompt = `Resumí en máximo 3 oraciones esta sesión clínica de ${especialidad} con un paciente de ${edad} años. En tercera persona, capturando los puntos clínicos más relevantes. Solo el resumen.

Notas:\n${notas_libres}`;

    try {
      const resumen = await completar(MODELO_TEXTO, [{ role: 'user', content: prompt }], 200);

      await supabaseAdmin.from('sesiones').update({ resumen_ia: resumen, ia_utilizada: true }).eq('id', sesion_id);

      res.json({ resumen });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al generar el resumen' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /ia/sugerir-derivacion  — Owl Alpha
// Analiza el caso y sugiere si conviene derivar y a quién
// ─────────────────────────────────────────────────────────────
router.post('/sugerir-derivacion',
  requireAuth,
  [body('paciente_id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { paciente_id, contexto_adicional } = req.body;

    const [{ data: paciente }, { data: sesiones }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('motivo_consulta, fecha_nacimiento').eq('id', paciente_id).single(),
      supabaseAdmin.from('sesiones').select('tipo, resumen_ia, notas_libres').eq('paciente_id', paciente_id).order('fecha', { ascending: false }).limit(5)
    ]);

    const historial = sesiones?.map(s => s.resumen_ia || s.notas_libres?.slice(0, 200)).filter(Boolean).join('\n\n') || 'Sin historial.';

    const prompt = `Analizá este caso clínico de un paciente de ${calcularEdad(paciente?.fecha_nacimiento)} años.

Motivo: ${paciente?.motivo_consulta || 'no registrado'}
Historial reciente:\n${historial}
${contexto_adicional ? `\nContexto adicional: ${contexto_adicional}` : ''}

Indicá brevemente:
1. ¿Se beneficiaría de una derivación? (Sí/No y por qué)
2. Si sí, ¿a qué especialidad (psicopedagogía, psicología, fonoaudiología)?
3. Objetivos sugeridos para la derivación

Respondé en 4-6 oraciones, lenguaje clínico profesional.`;

    try {
      const sugerencia = await completar(MODELO_TEXTO, [{ role: 'user', content: prompt }], 300);
      res.json({ sugerencia });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al analizar el caso' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /ia/analizar-pdf  — Gemini (gratis)
// Lee un archivo PDF del paciente y extrae información clínica relevante
// ─────────────────────────────────────────────────────────────
router.post('/analizar-pdf',
  requireAuth,
  [
    body('archivo_id').isUUID(),
    body('pregunta').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { archivo_id, pregunta } = req.body;

    // Obtener datos del archivo y verificar acceso
    const { data: archivo, error: archErr } = await supabaseAdmin
      .from('archivos_adjuntos')
      .select('storage_path, nombre_original, mime_type, paciente_id, tipo')
      .eq('id', archivo_id)
      .single();

    if (archErr || !archivo) return res.status(404).json({ error: 'Archivo no encontrado' });

    // Solo PDF e imágenes son soportados por visión
    const mimesSoportados = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!mimesSoportados.includes(archivo.mime_type)) {
      return res.status(422).json({ error: 'El archivo debe ser PDF o imagen para ser analizado por IA' });
    }

    // Generar URL firmada (5 minutos — suficiente para que Gemini la lea)
    const { data: urlData, error: urlErr } = await supabaseAdmin.storage
      .from('historias-clinicas')
      .createSignedUrl(archivo.storage_path, 300);

    if (urlErr) return res.status(500).json({ error: 'No se pudo acceder al archivo' });

    const instruccion = pregunta
      ? `El profesional pregunta: "${pregunta}". Respondé basándote en el documento.`
      : 'Extraé y resumí la información clínica más relevante: diagnósticos, resultados, recomendaciones y fechas importantes. Usá viñetas. Máximo 400 palabras.';

    try {
      const res2 = await openrouter.chat.completions.create({
        model: MODELO_PDF,
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Sos un asistente médico. Analizá este documento (${archivo.nombre_original}, tipo: ${archivo.tipo}). ${instruccion}`
              },
              {
                type: 'image_url',
                image_url: { url: urlData.signedUrl }
              }
            ]
          }
        ]
      });

      const analisis = res2.choices[0].message.content.trim();

      // Guardar el análisis como metadata del archivo
      await supabaseAdmin
        .from('archivos_adjuntos')
        .update({ descripcion: `[Análisis IA]\n${analisis}` })
        .eq('id', archivo_id)
        .is('descripcion', null); // Solo si no tenía descripción previa

      res.json({ analisis, modelo: MODELO_PDF });
    } catch (err) {
      console.error('OpenRouter Gemini error:', err.message);
      res.status(502).json({ error: 'Error al analizar el archivo con IA' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /ia/chat  — Chatbot con function calling
// ─────────────────────────────────────────────────────────────

const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_pacientes',
      description: 'Busca pacientes por nombre, apellido o DNI',
      parameters: {
        type: 'object',
        properties: {
          busqueda: { type: 'string', description: 'Nombre, apellido o DNI a buscar' }
        },
        required: ['busqueda']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ver_paciente',
      description: 'Obtiene el detalle completo de un paciente incluyendo sesiones recientes',
      parameters: {
        type: 'object',
        properties: {
          paciente_id: { type: 'string', description: 'UUID del paciente' }
        },
        required: ['paciente_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'crear_paciente',
      description: 'Registra un nuevo paciente en el sistema',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          dni: { type: 'string', description: '7 u 8 dígitos' },
          fecha_nacimiento: { type: 'string', description: 'Formato YYYY-MM-DD' },
          telefono: { type: 'string' },
          email: { type: 'string' },
          motivo_consulta: { type: 'string' },
          profesional_principal_id: { type: 'string', description: 'UUID del profesional asignado' }
        },
        required: ['nombre', 'apellido', 'dni', 'fecha_nacimiento']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ver_agenda',
      description: 'Ve los turnos del día o de una fecha específica',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD. Si no se indica, usa hoy.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'crear_turno',
      description: 'Agenda un turno para un paciente',
      parameters: {
        type: 'object',
        properties: {
          paciente_id: { type: 'string', description: 'UUID del paciente' },
          fecha_inicio: { type: 'string', description: 'Datetime en formato ISO 8601, ej: 2025-01-15T10:00:00' },
          duracion_minutos: { type: 'number', description: 'Duración en minutos, default 50' },
          tipo: { type: 'string', enum: ['tratamiento', 'evaluacion', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria'] },
          notas: { type: 'string' }
        },
        required: ['paciente_id', 'fecha_inicio']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listar_profesionales',
      description: 'Lista todos los profesionales del centro',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mostrar_formulario_paciente',
      description: 'Muestra un formulario interactivo en el chat para que el usuario complete los datos del paciente. Usar SIEMPRE que el usuario quiera crear un paciente nuevo, en lugar de preguntar campo por campo.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          dni: { type: 'string' },
          fecha_nacimiento: { type: 'string', description: 'YYYY-MM-DD' },
          telefono: { type: 'string' },
          email: { type: 'string' },
          motivo_consulta: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'registrar_sesion',
      description: 'Registra una sesión clínica realizada con un paciente',
      parameters: {
        type: 'object',
        properties: {
          paciente_id: { type: 'string' },
          fecha: { type: 'string', description: 'Datetime ISO 8601' },
          tipo: { type: 'string', enum: ['tratamiento', 'evaluacion', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria'] },
          duracion_minutos: { type: 'number' },
          notas_libres: { type: 'string', description: 'Notas clínicas de la sesión' },
          monto: { type: 'number' }
        },
        required: ['paciente_id', 'fecha', 'tipo']
      }
    }
  }
];

async function ejecutarTool(nombre, args, profesional) {
  switch (nombre) {
    case 'buscar_pacientes': {
      const { data } = await supabaseAdmin
        .from('pacientes')
        .select('id, nombre, apellido, dni, fecha_nacimiento, estado, telefono, motivo_consulta')
        .or(`nombre.ilike.%${args.busqueda}%,apellido.ilike.%${args.busqueda}%,dni.ilike.%${args.busqueda}%`)
        .is('deleted_at', null)
        .limit(5);
      return data || [];
    }

    case 'ver_paciente': {
      const [{ data: pac }, { data: sesiones }] = await Promise.all([
        supabaseAdmin.from('pacientes').select('*').eq('id', args.paciente_id).single(),
        supabaseAdmin.from('sesiones').select('id, fecha, tipo, resumen_ia, notas_libres, monto, pagado')
          .eq('paciente_id', args.paciente_id)
          .order('fecha', { ascending: false })
          .limit(5)
      ]);
      return { paciente: pac, sesiones_recientes: sesiones };
    }

    case 'mostrar_formulario_paciente': {
      return { type: 'form', form: 'crear_paciente', prefill: args };
    }

    case 'mostrar_formulario_turno': {
      return { type: 'form', form: 'crear_turno', prefill: args };
    }

    case 'crear_paciente': {
      if (!args.fecha_nacimiento) throw new Error('fecha_nacimiento es obligatoria para crear un paciente');
      const payload = {
        ...args,
        profesional_principal_id: args.profesional_principal_id || profesional.id,
        created_by: profesional.id,
        estado: 'activo'
      };
      const { data, error } = await supabaseAdmin.from('pacientes').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    case 'ver_agenda': {
      const fecha = args.fecha || new Date().toISOString().slice(0, 10);
      const inicio = `${fecha}T00:00:00`;
      const fin = `${fecha}T23:59:59`;
      const { data } = await supabaseAdmin
        .from('turnos')
        .select('id, fecha_inicio, fecha_fin, estado, tipo, paciente:pacientes(id, nombre, apellido, telefono), profesional:profesionales!profesional_id(nombre, apellido)')
        .gte('fecha_inicio', inicio)
        .lte('fecha_inicio', fin)
        .order('fecha_inicio');
      return { fecha, turnos: data || [] };
    }

    case 'crear_turno': {
      const duracion = args.duracion_minutos || 50;
      const inicio = new Date(args.fecha_inicio);
      const fin = new Date(inicio.getTime() + duracion * 60000);
      const { data, error } = await supabaseAdmin.from('turnos').insert({
        paciente_id: args.paciente_id,
        profesional_id: profesional.id,
        created_by: profesional.id,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        tipo: args.tipo || 'tratamiento',
        notas: args.notas,
        estado: 'programado'
      }).select('*, paciente:pacientes(nombre, apellido)').single();
      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_profesionales': {
      const { data } = await supabaseAdmin
        .from('profesionales')
        .select('id, nombre, apellido, especialidad, rol')
        .eq('activo', true);
      return data || [];
    }

    case 'registrar_sesion': {
      const { data, error } = await supabaseAdmin.from('sesiones').insert({
        paciente_id: args.paciente_id,
        profesional_id: profesional.id,
        created_by: profesional.id,
        fecha: args.fecha,
        tipo: args.tipo,
        duracion_minutos: args.duracion_minutos || 50,
        notas_libres: args.notas_libres,
        monto: args.monto
      }).select('*, paciente:pacientes(nombre, apellido)').single();
      if (error) throw new Error(error.message);
      return data;
    }

    default:
      throw new Error(`Tool desconocida: ${nombre}`);
  }
}

function parsearAccion(texto) {
  // Formato nativo de owl-alpha: <longcat_tool_call>nombre\n<longcat_arg_key>k</longcat_arg_key>\n<longcat_arg_value>v</longcat_arg_value>\n</longcat_tool_call>
  const longcatMatch = texto.match(/<longcat_tool_call>([\s\S]*?)<\/longcat_tool_call>/i);
  if (longcatMatch) {
    const inner = longcatMatch[1];
    const nameMatch = inner.match(/^([^\n<]+)/);
    if (!nameMatch) return null;
    const action = nameMatch[1].trim();
    const keys = [...inner.matchAll(/<longcat_arg_key>([\s\S]*?)<\/longcat_arg_key>/gi)].map(m => m[1].trim());
    const vals = [...inner.matchAll(/<longcat_arg_value>([\s\S]*?)<\/longcat_arg_value>/gi)].map(m => m[1].trim());
    const params = {};
    keys.forEach((k, i) => { params[k] = vals[i] ?? ''; });
    return { action, params };
  }

  // Fallback: bloque ```json
  const jsonMatch = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    if (json.action && json.params !== undefined) return json;
    return null;
  } catch { return null; }
}

function limpiarTexto(texto) {
  return texto
    .replace(/<longcat_tool_call>[\s\S]*?<\/longcat_tool_call>/gi, '')
    .replace(/```json[\s\S]*?```/gi, '')
    .trim();
}

router.post('/chat',
  requireAuth,
  [body('messages').isArray({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { messages } = req.body;
    const profesional = req.profesional;
    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Sanitizar campos del profesional para evitar prompt injection
    const sanitizar = (s) => String(s || '').replace(/[`<>{}[\]]/g, '').slice(0, 100);
    const profNombre = sanitizar(profesional.nombre);
    const profApellido = sanitizar(profesional.apellido);
    const profEspecialidad = sanitizar(profesional.especialidad);
    const profRol = sanitizar(profesional.rol);

    const systemPrompt = `Sos el asistente de un centro de salud interdisciplinario argentino.
Hoy es ${hoy}. Profesional activo: ${profNombre} ${profApellido} (${profEspecialidad}, ${profRol}).

Cuando el usuario pide una acción, respondé con un bloque JSON seguido de tu texto:

\`\`\`json
{"action": "NOMBRE_ACCION", "params": { ... }}
\`\`\`

Acciones disponibles:
- buscar_pacientes: params: { busqueda: string }
- ver_paciente: params: { paciente_id: string }
- mostrar_formulario_paciente: params: { nombre?, apellido?, dni?, fecha_nacimiento?, telefono?, email?, motivo_consulta? } — Usar INMEDIATAMENTE cuando el usuario quiera crear un paciente, sin pedir datos primero. El usuario los completa en el formulario.
- mostrar_formulario_turno: params: { paciente_id?, paciente_nombre?, fecha_inicio?, tipo?, duracion_minutos? } — Usar INMEDIATAMENTE cuando el usuario quiera agendar un turno. El usuario completa los datos en el formulario.
- crear_paciente: NO usar directamente; solo se invoca desde el formulario.
- ver_agenda: params: { fecha?: "YYYY-MM-DD" } (default: hoy)
- crear_turno: NO usar directamente; solo se invoca desde el formulario.
- registrar_sesion: params: { paciente_id, fecha: "YYYY-MM-DDTHH:MM:00", tipo, duracion_minutos?, notas_libres?, monto? }
- listar_profesionales: params: {}

Si no necesitás ejecutar ninguna acción, respondé solo con texto plano.
Respondé siempre en español, conciso.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    try {
      const historial = [...chatMessages];
      const toolResults = [];
      let mensajeFinal = '';

      // Hasta 5 acciones encadenadas por mensaje
      for (let i = 0; i < 5; i++) {
        const response = await openrouter.chat.completions.create({
          model: MODELO_CHAT,
          messages: historial,
          max_tokens: 1000
        });

        const rawText = response.choices[0].message.content.trim();
        const accion = parsearAccion(rawText);

        if (!accion) {
          mensajeFinal = limpiarTexto(rawText);
          break;
        }

        // Ejecutar la acción
        let toolResult;
        try {
          const resultado = await ejecutarTool(accion.action, accion.params || {}, profesional);
          toolResult = { name: accion.action, result: resultado };
        } catch (err) {
          toolResult = { name: accion.action, result: { error: err.message } };
        }
        toolResults.push(toolResult);

        // Formularios interactivos: el usuario completa los datos en el front, terminar acá
        if (accion.action === 'mostrar_formulario_paciente') {
          mensajeFinal = limpiarTexto(rawText) || 'Completá los datos del paciente:';
          break;
        }
        if (accion.action === 'mostrar_formulario_turno') {
          mensajeFinal = limpiarTexto(rawText) || 'Completá los datos del turno:';
          break;
        }

        // Agregar resultado al historial para la siguiente iteración
        historial.push({ role: 'assistant', content: rawText });
        historial.push({
          role: 'user',
          content: `Resultado de "${accion.action}":\n${JSON.stringify(toolResult.result, null, 2)}\n\nSi tenés más acciones pendientes, ejecutalas. Si terminaste, respondé en lenguaje natural resumiendo todo lo que hiciste.`
        });
      }

      // Si el loop terminó sin mensaje final, pedir resumen
      if (!mensajeFinal) {
        const resumenResp = await openrouter.chat.completions.create({
          model: MODELO_CHAT,
          messages: [...historial, { role: 'user', content: 'Resumí en lenguaje natural todo lo que hiciste, sin JSON.' }],
          max_tokens: 400
        });
        mensajeFinal = limpiarTexto(resumenResp.choices[0].message.content.trim());
      }

      res.json({ message: mensajeFinal, tool_results: toolResults });

    } catch (err) {
      console.error('Chat IA error:', err.message, err.status, JSON.stringify(err.error));
      res.status(502).json({ error: err.message || 'Error al conectar con la IA' });
    }
  }
);

module.exports = router;
