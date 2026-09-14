const request = require('supertest');
const app = require('../../src/index');
const { obtenerSesion } = require('../helpers/sesiones');

// Flujo completo: login → crear paciente → confirmar que otra cuenta NO lo ve.
// Es el único test end-to-end del alcance definido — cubre en un solo caso
// tanto la creación real contra la base como el aislamiento de datos.

describe('E2E: crear paciente y verificar aislamiento', () => {
  let fausto;
  let juanCruz;
  let pacienteCreadoId;

  beforeAll(async () => {
    fausto = await obtenerSesion('fausto');
    juanCruz = await obtenerSesion('juanCruz');
  });

  afterAll(async () => {
    // Limpieza: soft-delete del paciente creado en este test
    if (pacienteCreadoId) {
      await request(app)
        .delete(`/api/pacientes/${pacienteCreadoId}`)
        .set('Authorization', `Bearer ${fausto.token}`);
    }
  });

  test('flujo completo', async () => {
    // 1. Fausto crea un paciente nuevo
    const dniUnico = String(Math.floor(10000000 + Math.random() * 89999999));
    const crear = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({
        nombre: 'E2E',
        apellido: 'TestAislamiento',
        dni: dniUnico,
        fecha_nacimiento: '1995-05-05'
      });

    expect(crear.status).toBe(201);
    pacienteCreadoId = crear.body.id;

    // 2. Fausto lo ve en su propio listado
    const listadoFausto = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`);

    const idsDeFausto = listadoFausto.body.data.map(p => p.id);
    expect(idsDeFausto).toContain(pacienteCreadoId);

    // 3. Juan Cruz NO lo ve en su listado
    const listadoJuanCruz = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${juanCruz.token}`);

    const idsDeJuanCruz = listadoJuanCruz.body.data.map(p => p.id);
    expect(idsDeJuanCruz).not.toContain(pacienteCreadoId);

    // 4. Juan Cruz tampoco puede acceder por ID directo
    const accesoDirecto = await request(app)
      .get(`/api/pacientes/${pacienteCreadoId}`)
      .set('Authorization', `Bearer ${juanCruz.token}`);

    expect(accesoDirecto.status).toBe(404);
  });
});
