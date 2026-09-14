const request = require('supertest');
const app = require('../../src/index');
const { obtenerSesion } = require('../helpers/sesiones');

// Estos tests cubren el bug encontrado en sesiones anteriores: pedirle a la
// IA que "sugiera una derivación" para un paciente sin datos clínicos reales
// (o con un contexto absurdo tipo broma) hacía que inventara un diagnóstico
// completo con total confianza. La regla correcta: sin información real, la
// IA debe decir que no puede analizar el caso, nunca inventar.
//
// Nota: estos tests dependen del modelo de IA gratuito (OpenRouter), que
// puede estar temporalmente saturado — si fallan por timeout/502, no
// necesariamente es una regresión del código, puede ser disponibilidad del
// proveedor. Reintentar antes de asumir que el prompt se rompió.

describe('IA no debe alucinar sin datos clínicos reales', () => {
  let fausto;

  beforeAll(async () => {
    fausto = await obtenerSesion('fausto');
  });

  test('sugerir-derivacion con paciente sin motivo ni historial no inventa un diagnóstico', async () => {
    // Buscamos cualquier paciente real de Fausto para tener un ID válido;
    // el contenido clínico (motivo_consulta, historial) puede estar vacío.
    const listado = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`);

    if (listado.body.data.length === 0) {
      console.warn('Sin pacientes para testear — saltando caso');
      return;
    }

    const pacienteId = listado.body.data[0].id;

    const res = await request(app)
      .post('/api/ia/sugerir-derivacion')
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({
        paciente_id: pacienteId,
        contexto_adicional: 'adicto a tung tung tung sahur' // mismo caso absurdo real que disparó el bug
      });

    expect(res.status).toBe(200);
    const texto = res.body.sugerencia.toLowerCase();

    // No debe mencionar un diagnóstico inventado a partir de la broma
    expect(texto).not.toMatch(/adicci[oó]n|conducta adictiva|dependencia/);
    // Debe indicar falta de información, según la regla del prompt
    expect(texto).toMatch(/no hay informaci[oó]n|informaci[oó]n suficiente|no tengo/);
  });

  test('requiere autenticación', async () => {
    const res = await request(app)
      .post('/api/ia/sugerir-derivacion')
      .send({ paciente_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(401);
  });
});
