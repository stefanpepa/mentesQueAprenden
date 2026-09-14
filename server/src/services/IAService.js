const OpenAI = require('openai');
const { supabaseAdmin } = require('../config/supabase');
const { extraerTextoDocumento } = require('./geminiExtractor');

const MODELO_TEXTO = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const MODELO_CHAT = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

const TIPOS_SESION = ['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria'];

const SYSTEM_PROMPT_BASE = `Sos el asistente de un centro de salud interdisciplinario argentino.

Cuando el usuario pide una acción, respondé con un bloque JSON seguido de tu texto:

\`\`\`json
{"action": "NOMBRE_ACCION", "params": { ... }}
\`\`\`

Acciones disponibles:
- buscar_pacientes: params: { busqueda: string }
- ver_paciente: params: { paciente_id: string }
- mostrar_formulario_paciente: params: { nombre?, apellido?, dni?, fecha_nacimiento?, telefono?, email?, motivo_consulta? } — Usar INMEDIATAMENTE cuando el usuario quiera crear/registrar/agendar un PACIENTE nuevo (persona que todavía no existe en el sistema), sin pedir datos primero. El usuario los completa en el formulario. Ejemplos que van acá: "agendame un paciente nuevo", "quiero cargar un paciente", "registrar un paciente".
- mostrar_formulario_turno: params: { paciente_id?, paciente_nombre?, fecha_inicio?, tipo?, duracion_minutos? } — Usar INMEDIATAMENTE cuando el usuario quiera agendar un TURNO (una cita/sesión) para un paciente que YA EXISTE en el sistema. El usuario completa los datos en el formulario. Si no está claro si el paciente ya existe, usá buscar_pacientes primero; si no aparece, ofrecé mostrar_formulario_paciente en su lugar.
- crear_paciente: NO usar directamente; solo se invoca desde el formulario.
- ver_agenda: params: { fecha?: "YYYY-MM-DD" } (default: hoy)
- crear_turno: NO usar directamente; solo se invoca desde el formulario.
- registrar_sesion: params: { paciente_id, fecha: "YYYY-MM-DDTHH:MM:00", tipo, duracion_minutos?, notas_libres?, monto? }
- listar_profesionales: params: {}
- eliminar_paciente: params: { paciente_id: string } — DA DE BAJA a un paciente (no borra su historial clínico, solo lo oculta de los listados). Es una acción DESTRUCTIVA e IRREVERSIBLE desde el chat: nunca la ejecutes directamente aunque el usuario diga el nombre. Primero usá buscar_pacientes para encontrar el paciente_id real (si no hay resultados, avisá que no existe, no inventes que preguntaste un ID). Después mostrale al usuario el nombre completo encontrado y preguntale explícitamente "¿Confirmás eliminar a [nombre]? Esta acción no se puede deshacer desde acá." Solo ejecutá eliminar_paciente en el mensaje siguiente si el usuario confirma claramente (sí, dale, confirmo, etc).

Si no necesitás ejecutar ninguna acción, respondé solo con texto plano.
Respondé siempre en español, conciso.

También sos un apoyo clínico/técnico para el profesional: si te preguntan algo de índole psicopedagógica, psicológica o fonoaudiológica (tests, criterios diagnósticos, estrategias de intervención, interpretación de resultados, bibliografía, etc), respondé con el conocimiento profesional que tengas, como lo haría un colega con experiencia.

REGLAS CRÍTICAS SOBRE PRECISIÓN (tenés modelo de lenguaje chico, propenso a inventar — seguí esto estricto):
- Respondé con confianza cuando el conocimiento es general o conceptual (para qué sirve un test, qué mide, cómo se usa un criterio diagnóstico, estrategias de intervención). No te abstengas de estas preguntas.
- Pero NUNCA inventes datos técnicos EXACTOS de tests o instrumentos psicométricos (ej: Test de Caras-R, WISC, ENI, etc.) si no estás realmente seguro: cantidad exacta de ítems, tiempos de aplicación en minutos, puntos de corte numéricos, normas de baremación, fórmulas de corrección. Estos son los datos donde más te equivocás. Si no tenés certeza alta de un número o dato preciso así, decilo explícitamente ("no tengo la certeza del dato exacto, verificalo en el manual del test") en vez de inventar un número que suene plausible. La diferencia es: explicaciones y criterio SÍ, números/cifras exactas dudosas NO.
- NUNCA inventes datos clínicos de un paciente particular (diagnósticos, resultados de evaluaciones, fechas, historial) que no vengan de una tool ejecutada en esta conversación (buscar_pacientes, ver_paciente, ver_agenda, etc). Si no tenés el dato porque no lo consultaste, ejecutá la acción correspondiente o decí que no lo sabés. Esto no aplica al conocimiento técnico general, solo a datos específicos de pacientes reales del sistema.`;

class IAService {
  constructor() {
    this.openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: 25000,
      maxRetries: 2,
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'Centro de Salud Interdisciplinario'
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  calcularEdad(fechaNac) {
    if (!fechaNac) return '?';
    const hoy = new Date();
    const nac = new Date(fechaNac);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() ||
       (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  async completar(modelo, mensajes, maxTokens = 500) {
    const res = await this.openrouter.chat.completions.create({
      model: modelo,
      max_tokens: maxTokens,
      messages: mensajes
    });
    return res.choices[0].message.content.trim();
  }

  // El chatbot usa supabaseAdmin (bypasea RLS), así que hay que replicar acá
  // la misma regla de acceso que la policy pacientes_select: dueño o derivación activa.
  async tieneAccesoPorDerivacion(pacienteId, profesionalId) {
    const { data } = await supabaseAdmin
      .from('derivaciones')
      .select('id')
      .eq('paciente_id', pacienteId)
      .eq('activa', true)
      .eq('estado', 'aceptada')
      .or(`profesional_origen_id.eq.${profesionalId},profesional_destino_id.eq.${profesionalId}`)
      .limit(1);
    return (data || []).length > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Sugerencias con IA de texto
  // ─────────────────────────────────────────────────────────────

  async sugerirNotas({ notas_parciales, paciente_id, tipo_sesion, especialidad }) {
    const [{ data: paciente }, { data: anteriores }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('fecha_nacimiento, motivo_consulta').eq('id', paciente_id).single(),
      supabaseAdmin.from('sesiones').select('fecha, tipo, resumen_ia, notas_libres').eq('paciente_id', paciente_id).order('fecha', { ascending: false }).limit(3)
    ]);

    const edad = this.calcularEdad(paciente?.fecha_nacimiento);
    const historial = anteriores?.length
      ? anteriores.map(s => `- ${new Date(s.fecha).toLocaleDateString('es-AR')}: ${s.resumen_ia || s.notas_libres?.slice(0, 150) || 'sin notas'}`).join('\n')
      : 'Primera sesión.';

    const prompt = `Sos un asistente especializado en ${especialidad} para profesionales de la salud en Argentina.

Paciente: ${edad} años. Motivo: ${paciente?.motivo_consulta || 'no registrado'}.
Sesiones anteriores:\n${historial}

El profesional registró estas notas parciales de una sesión de tipo "${tipo_sesion}":
"${notas_parciales}"

Completá y estructurá las notas en primera persona del profesional. Incluí: observaciones clínicas, intervenciones realizadas, respuesta del paciente, y aspectos a trabajar. Máximo 300 palabras, lenguaje clínico de ${especialidad} en Argentina. Solo las notas, sin títulos.`;

    return this.completar(MODELO_TEXTO, [{ role: 'user', content: prompt }]);
  }

  async resumirSesion({ sesion_id, notas_libres }) {
    const { data: sesion } = await supabaseAdmin
      .from('sesiones')
      .select('tipo, paciente:pacientes(fecha_nacimiento), profesional:profesionales!profesional_id(especialidad)')
      .eq('id', sesion_id)
      .single();

    const edad = this.calcularEdad(sesion?.paciente?.fecha_nacimiento);
    const especialidad = sesion?.profesional?.especialidad || 'salud';

    const prompt = `Resumí en máximo 3 oraciones esta sesión clínica de ${especialidad} con un paciente de ${edad} años. En tercera persona, capturando los puntos clínicos más relevantes. Solo el resumen.

Notas:\n${notas_libres}`;

    const resumen = await this.completar(MODELO_TEXTO, [{ role: 'user', content: prompt }], 200);
    await supabaseAdmin.from('sesiones').update({ resumen_ia: resumen, ia_utilizada: true }).eq('id', sesion_id);
    return resumen;
  }

  async sugerirDerivacion({ paciente_id, contexto_adicional }) {
    const [{ data: paciente }, { data: sesiones }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('motivo_consulta, fecha_nacimiento').eq('id', paciente_id).single(),
      supabaseAdmin.from('sesiones').select('tipo, resumen_ia, notas_libres').eq('paciente_id', paciente_id).order('fecha', { ascending: false }).limit(5)
    ]);

    const historial = sesiones?.map(s => s.resumen_ia || s.notas_libres?.slice(0, 200)).filter(Boolean).join('\n\n') || 'Sin historial.';

    const prompt = `Analizá este caso clínico de un paciente de ${this.calcularEdad(paciente?.fecha_nacimiento)} años.

Motivo: ${paciente?.motivo_consulta || 'no registrado'}
Historial reciente:\n${historial}
${contexto_adicional ? `\nContexto adicional: ${contexto_adicional}` : ''}

IMPORTANTE: Si el motivo no está registrado, el historial está vacío, y/o el "contexto adicional" no es información clínica real (es una broma, un texto sin sentido, o no corresponde a ningún cuadro reconocible), NO inventes un diagnóstico ni un análisis clínico. En ese caso respondé únicamente: "No hay información clínica suficiente para sugerir una derivación. Cargá el motivo de consulta y/o notas de sesión para poder analizar el caso." No completes esta falta de datos con suposiciones.

Si SÍ hay información clínica real y coherente, indicá brevemente:
1. ¿Se beneficiaría de una derivación? (Sí/No y por qué)
2. Si sí, ¿a qué especialidad (psicopedagogía, psicología, fonoaudiología)?
3. Objetivos sugeridos para la derivación

Respondé en 4-6 oraciones, lenguaje clínico profesional.`;

    return this.completar(MODELO_TEXTO, [{ role: 'user', content: prompt }], 300);
  }

  async analizarPDF({ archivo_id, pregunta }) {
    const { data: archivo, error: archErr } = await supabaseAdmin
      .from('archivos_adjuntos')
      .select('storage_path, nombre_original, mime_type, paciente_id, tipo')
      .eq('id', archivo_id)
      .single();

    if (archErr || !archivo) {
      const notFound = new Error('Archivo no encontrado');
      notFound.status = 404;
      throw notFound;
    }

    const mimesSoportados = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!mimesSoportados.includes(archivo.mime_type)) {
      const invalidType = new Error('El archivo debe ser PDF o imagen para ser analizado por IA');
      invalidType.status = 422;
      throw invalidType;
    }

    const { data: urlData, error: urlErr } = await supabaseAdmin.storage
      .from('historias-clinicas')
      .createSignedUrl(archivo.storage_path, 300);

    if (urlErr) {
      const storageError = new Error('No se pudo acceder al archivo');
      storageError.status = 500;
      throw storageError;
    }

    const instruccion = pregunta
      ? `El profesional pregunta: "${pregunta}". Respondé basándote en el texto del documento.`
      : 'Resumí la información clínica más relevante: diagnósticos, resultados, recomendaciones y fechas importantes. Usá viñetas. Máximo 400 palabras.';

    // Etapa 1 — extracción: Gemini transcribe el documento sin interpretarlo.
    const textoExtraido = await extraerTextoDocumento(urlData.signedUrl, archivo.nombre_original, archivo.mime_type);

    // Etapa 2 — análisis: el modelo de texto interpreta el contenido ya transcripto.
    const prompt = `Sos un asistente médico. A continuación el texto transcripto de un documento (${archivo.nombre_original}, tipo: ${archivo.tipo}).\n\n"""\n${textoExtraido}\n"""\n\n${instruccion}`;
    const analisis = await this.completar(MODELO_TEXTO, [{ role: 'user', content: prompt }], 600);

    // Guardar el análisis como metadata del archivo (solo si no tenía descripción previa)
    await supabaseAdmin
      .from('archivos_adjuntos')
      .update({ descripcion: `[Análisis IA]\n${analisis}` })
      .eq('id', archivo_id)
      .is('descripcion', null);

    return { analisis, texto_extraido: textoExtraido, modelo: MODELO_TEXTO };
  }

  // ─────────────────────────────────────────────────────────────
  // Chatbot con function calling manual
  // ─────────────────────────────────────────────────────────────

  async ejecutarTool(nombre, args, profesional) {
    switch (nombre) {
      case 'buscar_pacientes': {
        const { data: derivados } = await supabaseAdmin
          .from('derivaciones')
          .select('paciente_id')
          .eq('activa', true)
          .eq('estado', 'aceptada')
          .or(`profesional_origen_id.eq.${profesional.id},profesional_destino_id.eq.${profesional.id}`);
        const idsDerivados = (derivados || []).map(d => d.paciente_id);

        const filtroAcceso = idsDerivados.length
          ? `profesional_principal_id.eq.${profesional.id},id.in.(${idsDerivados.join(',')})`
          : `profesional_principal_id.eq.${profesional.id}`;

        const { data: candidatos } = await supabaseAdmin
          .from('pacientes')
          .select('id, nombre, apellido, dni, fecha_nacimiento, estado, telefono, motivo_consulta, profesional_principal_id')
          .or(`nombre.ilike.%${args.busqueda}%,apellido.ilike.%${args.busqueda}%,dni.ilike.%${args.busqueda}%`)
          .is('deleted_at', null)
          .limit(50);

        const idsAcceso = new Set(idsDerivados);
        const data = (candidatos || [])
          .filter(p => p.profesional_principal_id === profesional.id || idsAcceso.has(p.id))
          .slice(0, 5);
        return data.map(({ profesional_principal_id, ...p }) => p);
      }

      case 'ver_paciente': {
        const { data: pac } = await supabaseAdmin.from('pacientes').select('*').eq('id', args.paciente_id).single();
        if (!pac) return { error: 'Paciente no encontrado' };

        const tieneAcceso = pac.profesional_principal_id === profesional.id || await this.tieneAccesoPorDerivacion(args.paciente_id, profesional.id);
        if (!tieneAcceso) return { error: 'No tenés acceso a este paciente' };

        const { data: sesiones } = await supabaseAdmin.from('sesiones')
          .select('id, fecha, tipo, resumen_ia, notas_libres, monto, pagado')
          .eq('paciente_id', args.paciente_id)
          .order('fecha', { ascending: false })
          .limit(5);
        return { paciente: pac, sesiones_recientes: sesiones };
      }

      case 'mostrar_formulario_paciente':
        return { type: 'form', form: 'crear_paciente', prefill: args };

      case 'mostrar_formulario_turno':
        return { type: 'form', form: 'crear_turno', prefill: args };

      case 'crear_paciente': {
        if (!args.fecha_nacimiento) throw new Error('fecha_nacimiento es obligatoria para crear un paciente');
        if (!args.dni || !/^\d{7,8}$/.test(args.dni)) throw new Error('dni inválido: debe tener 7 u 8 dígitos');
        const CAMPOS_PACIENTE = ['nombre', 'apellido', 'dni', 'fecha_nacimiento', 'telefono', 'email', 'motivo_consulta'];
        const payload = {
          ...Object.fromEntries(Object.entries(args).filter(([k]) => CAMPOS_PACIENTE.includes(k))),
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
        if (args.tipo && !TIPOS_SESION.includes(args.tipo)) {
          throw new Error(`tipo inválido: debe ser uno de ${TIPOS_SESION.join(', ')}`);
        }
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

      case 'eliminar_paciente': {
        if (!args.paciente_id) throw new Error('paciente_id es obligatorio');
        const { data, error } = await supabaseAdmin
          .from('pacientes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.paciente_id)
          .is('deleted_at', null)
          .select('id, nombre, apellido')
          .single();
        if (error) throw new Error(error.code === 'PGRST116' ? 'Paciente no encontrado' : error.message);
        return data;
      }

      default:
        throw new Error(`Tool desconocida: ${nombre}`);
    }
  }

  parsearAccion(texto) {
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
    } catch {
      return null;
    }
  }

  limpiarTexto(texto) {
    return texto
      .replace(/<longcat_tool_call>[\s\S]*?<\/longcat_tool_call>/gi, '')
      .replace(/```json[\s\S]*?```/gi, '')
      .trim();
  }

  construirSystemPrompt(profesional) {
    const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sanitizar = (s) => String(s || '').replace(/[`<>{}[\]]/g, '').slice(0, 100);
    const profNombre = sanitizar(profesional.nombre);
    const profApellido = sanitizar(profesional.apellido);
    const profEspecialidad = sanitizar(profesional.especialidad);
    const profRol = sanitizar(profesional.rol);

    return `${SYSTEM_PROMPT_BASE}\n\nHoy es ${hoy}. Profesional activo: ${profNombre} ${profApellido} (${profEspecialidad}, ${profRol}).`;
  }

  async chat({ messages, profesional }) {
    const chatMessages = [
      { role: 'system', content: this.construirSystemPrompt(profesional) },
      ...messages
    ];

    const historial = [...chatMessages];
    const toolResults = [];
    let mensajeFinal = '';

    // Hasta 5 acciones encadenadas por mensaje
    for (let i = 0; i < 5; i++) {
      const response = await this.openrouter.chat.completions.create({
        model: MODELO_CHAT,
        messages: historial,
        max_tokens: 500
      });

      const rawText = response.choices[0].message.content.trim();
      const accion = this.parsearAccion(rawText);

      if (!accion) {
        mensajeFinal = this.limpiarTexto(rawText);
        break;
      }

      let toolResult;
      try {
        const resultado = await this.ejecutarTool(accion.action, accion.params || {}, profesional);
        toolResult = { name: accion.action, result: resultado };
      } catch (err) {
        toolResult = { name: accion.action, result: { error: err.message } };
      }
      toolResults.push(toolResult);

      // Formularios interactivos: el usuario completa los datos en el front, terminar acá
      if (accion.action === 'mostrar_formulario_paciente') {
        mensajeFinal = this.limpiarTexto(rawText) || 'Completá los datos del paciente:';
        break;
      }
      if (accion.action === 'mostrar_formulario_turno') {
        mensajeFinal = this.limpiarTexto(rawText) || 'Completá los datos del turno:';
        break;
      }

      historial.push({ role: 'assistant', content: rawText });
      historial.push({
        role: 'user',
        content: `Resultado de "${accion.action}":\n${JSON.stringify(toolResult.result, null, 2)}\n\nSi tenés más acciones pendientes, ejecutalas. Si terminaste, respondé en lenguaje natural resumiendo todo lo que hiciste.`
      });
    }

    if (!mensajeFinal) {
      const resumenResp = await this.openrouter.chat.completions.create({
        model: MODELO_CHAT,
        messages: [...historial, { role: 'user', content: 'Resumí en lenguaje natural todo lo que hiciste, sin JSON.' }],
        max_tokens: 400
      });
      mensajeFinal = this.limpiarTexto(resumenResp.choices[0].message.content.trim());
    }

    return { message: mensajeFinal, tool_results: toolResults };
  }
}

module.exports = new IAService();
