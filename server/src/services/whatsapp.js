const axios = require('axios');
const { format } = require('date-fns');

const BASE_URL = 'https://graph.facebook.com/v21.0';

// Enviar recordatorio de turno via WhatsApp Business API (Meta Cloud API)
async function enviarRecordatorio(turno) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_RECORDATORIO || 'recordatorio_turno';

  if (!token || !phoneId) {
    console.warn('WhatsApp no configurado: falta WHATSAPP_TOKEN o WHATSAPP_PHONE_ID');
    return { ok: false, error: 'WhatsApp no configurado' };
  }

  const telefono = limpiarTelefono(turno.paciente?.telefono);
  if (!telefono) return { ok: false, error: 'Teléfono inválido' };

  const fecha = format(new Date(turno.fecha_inicio), "d 'de' MMMM 'a las' HH:mm");
  const profesionalNombre = `${turno.profesional?.nombre} ${turno.profesional?.apellido}`;

  try {
    const { data } = await axios.post(
      `${BASE_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es_AR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: turno.paciente?.nombre },
                { type: 'text', text: fecha },
                { type: 'text', text: profesionalNombre }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { ok: true, message_id: data.messages?.[0]?.id };
  } catch (err) {
    console.error('Error WhatsApp:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data?.error?.message || err.message };
  }
}

// Enviar mensaje libre (texto simple, para notificaciones)
async function enviarMensaje(telefono, texto) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp no configurado' };

  const tel = limpiarTelefono(telefono);
  if (!tel) return { ok: false, error: 'Teléfono inválido' };

  try {
    const { data } = await axios.post(
      `${BASE_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: tel,
        type: 'text',
        text: { body: texto }
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, message_id: data.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err.response?.data?.error?.message || err.message };
  }
}

// Normaliza número argentino al formato internacional (549XXXXXXXXXX)
function limpiarTelefono(tel) {
  if (!tel) return null;
  let num = tel.replace(/\D/g, '');
  // Quitar 0 inicial de área y 15 de celular argentino
  if (num.startsWith('0')) num = num.slice(1);
  if (num.startsWith('15')) num = num.slice(2);
  // Agregar código Argentina si no está
  if (!num.startsWith('54')) num = '54' + num;
  // WhatsApp Argentina: 54 9 + área + número (549XXXXXXXXXX)
  if (num.startsWith('54') && !num.startsWith('549')) {
    num = '549' + num.slice(2);
  }
  return num.length >= 12 ? num : null;
}

module.exports = { enviarRecordatorio, enviarMensaje };
