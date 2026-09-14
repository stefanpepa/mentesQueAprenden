const request = require('supertest');
const app = require('../../src/index');
const { obtenerSesion } = require('../helpers/sesiones');

// Estos tests cubren el bug más grave detectado durante el desarrollo: los
// admin (y en un momento, todos los profesionales) veían pacientes ajenos.
// La regla correcta: cada cuenta ve únicamente sus propios pacientes, salvo
// que exista una derivación ACEPTADA (no alcanza con "pendiente").

describe('Aislamiento de pacientes entre profesionales', () => {
  let juanCruz;
  let fausto;

  beforeAll(async () => {
    juanCruz = await obtenerSesion('juanCruz');
    fausto = await obtenerSesion('fausto');
  });

  test('un profesional solo ve pacientes propios o con derivación aceptada hacia él, nunca ajenos sin relación', async () => {
    const res = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${juanCruz.token}`);

    expect(res.status).toBe(200);
    // Cada paciente visible debe ser propio de Juan Cruz o tener una
    // derivación real (verificada por separado en el test de abajo) — acá
    // solo confirmamos que no ve pacientes cuyo dueño es otro profesional
    // sin ningún vínculo de derivación.
    for (const paciente of res.body.data) {
      const esPropio = paciente.profesional_principal?.id === juanCruz.profesional.id;
      if (!esPropio) {
        // Si no es propio, debe existir una derivación aceptada y activa
        const derivaciones = await request(app)
          .get('/api/derivaciones')
          .set('Authorization', `Bearer ${juanCruz.token}`);
        const tieneAcceso = derivaciones.body.some(
          d => d.paciente_id === paciente.id && d.estado === 'aceptada' && d.activa
        );
        expect(tieneAcceso).toBe(true);
      }
    }
  });

  test('un admin no ve pacientes de otro profesional en el listado', async () => {
    const res = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`);

    expect(res.status).toBe(200);
    // Todos los pacientes devueltos deben pertenecer a Fausto
    for (const paciente of res.body.data) {
      expect(paciente.profesional_principal?.id).toBe(fausto.profesional.id);
    }
  });

  test('acceder por ID a un paciente ajeno sin derivación da 404, no el dato', async () => {
    // Buscamos un paciente de Fausto que NO tenga derivación aceptada hacia
    // Juan Cruz (puede haber alguno de pruebas anteriores) y confirmamos
    // que sin ese vínculo, el acceso directo por ID da 404.
    const [listado, derivacionesJuanCruz] = await Promise.all([
      request(app).get('/api/pacientes').set('Authorization', `Bearer ${fausto.token}`),
      request(app).get('/api/derivaciones').set('Authorization', `Bearer ${juanCruz.token}`)
    ]);

    const idsConAcceso = new Set(
      derivacionesJuanCruz.body
        .filter(d => d.estado === 'aceptada' && d.activa)
        .map(d => d.paciente_id)
    );

    const pacienteSinRelacion = listado.body.data.find(p => !idsConAcceso.has(p.id));

    if (!pacienteSinRelacion) {
      console.warn('Todos los pacientes de Fausto tienen derivación hacia Juan Cruz — saltando caso');
      return;
    }

    const res = await request(app)
      .get(`/api/pacientes/${pacienteSinRelacion.id}`)
      .set('Authorization', `Bearer ${juanCruz.token}`);

    expect(res.status).toBe(404);
  });

  test('sin token no se puede acceder al listado de pacientes', async () => {
    const res = await request(app).get('/api/pacientes');
    expect(res.status).toBe(401);
  });

  test('una derivación PENDIENTE (sin aceptar) no da acceso al paciente', async () => {
    const { supabaseAdmin } = require('../../src/config/supabase');

    const [listado, derivacionesJuanCruz] = await Promise.all([
      request(app).get('/api/pacientes').set('Authorization', `Bearer ${fausto.token}`),
      request(app).get('/api/derivaciones').set('Authorization', `Bearer ${juanCruz.token}`)
    ]);

    const idsConAccesoPrevio = new Set(
      derivacionesJuanCruz.body
        .filter(d => d.estado === 'aceptada' && d.activa)
        .map(d => d.paciente_id)
    );

    const pacienteSinRelacion = listado.body.data.find(p => !idsConAccesoPrevio.has(p.id));

    if (!pacienteSinRelacion) {
      console.warn('Todos los pacientes de Fausto ya tienen derivación hacia Juan Cruz — saltando caso');
      return;
    }
    const pacienteId = pacienteSinRelacion.id;

    const { data: derivacion } = await supabaseAdmin
      .from('derivaciones')
      .insert({
        paciente_id: pacienteId,
        profesional_origen_id: fausto.profesional.id,
        profesional_destino_id: juanCruz.profesional.id,
        motivo: 'test aislamiento — derivación pendiente'
      })
      .select()
      .single();

    try {
      const listadoJuanCruz = await request(app)
        .get('/api/pacientes')
        .set('Authorization', `Bearer ${juanCruz.token}`);

      const idsVisibles = listadoJuanCruz.body.data.map(p => p.id);
      expect(idsVisibles).not.toContain(pacienteId);

      const accesoDirecto = await request(app)
        .get(`/api/pacientes/${pacienteId}`)
        .set('Authorization', `Bearer ${juanCruz.token}`);
      expect(accesoDirecto.status).toBe(404);
    } finally {
      await supabaseAdmin.from('derivaciones').delete().eq('id', derivacion.id);
    }
  });
});
