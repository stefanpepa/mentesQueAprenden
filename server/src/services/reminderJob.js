const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const { enviarRecordatorio } = require('./whatsapp');

// Corre todos los días a las 9:00 AM (hora Argentina)
function iniciarReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[ReminderJob] Ejecutando envío de recordatorios...');

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const inicio = new Date(manana.setHours(0, 0, 0, 0)).toISOString();
    const fin = new Date(manana.setHours(23, 59, 59, 999)).toISOString();

    const { data: turnos, error } = await supabaseAdmin
      .from('turnos')
      .select('*, paciente:pacientes(nombre, apellido, telefono), profesional:profesionales(nombre, apellido)')
      .in('estado', ['programado', 'confirmado'])
      .eq('recordatorio_enviado', false)
      .gte('fecha_inicio', inicio)
      .lte('fecha_inicio', fin);

    if (error) {
      console.error('[ReminderJob] Error al obtener turnos:', error);
      return;
    }

    console.log(`[ReminderJob] ${turnos.length} turnos para recordar mañana`);

    for (const turno of turnos) {
      if (!turno.paciente?.telefono) continue;

      const resultado = await enviarRecordatorio(turno);
      if (resultado.ok) {
        await supabaseAdmin
          .from('turnos')
          .update({ recordatorio_enviado: true, recordatorio_enviado_at: new Date().toISOString() })
          .eq('id', turno.id);
        console.log(`[ReminderJob] Recordatorio enviado a ${turno.paciente.nombre} ${turno.paciente.apellido}`);
      } else {
        console.error(`[ReminderJob] Error enviando a ${turno.paciente.nombre}:`, resultado.error);
      }
    }
  }, { timezone: 'America/Argentina/Buenos_Aires' });

  console.log('[ReminderJob] Job de recordatorios iniciado (9:00 AM diario)');
}

module.exports = { iniciarReminderJob };
