const request = require('supertest');
const app = require('../../src/index');
const { obtenerSesion } = require('../helpers/sesiones');

describe('Validación de POST/PATCH /pacientes', () => {
  let fausto;

  beforeAll(async () => {
    fausto = await obtenerSesion('fausto');
  });

  test('crear paciente sin campos obligatorios da 422', async () => {
    const res = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({ nombre: 'Test' }); // falta apellido, dni, fecha_nacimiento

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  test('crear paciente con DNI inválido (no 7-8 dígitos) da 422', async () => {
    const res = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({
        nombre: 'Test',
        apellido: 'Validacion',
        dni: '123', // inválido
        fecha_nacimiento: '2000-01-01'
      });

    expect(res.status).toBe(422);
  });

  test('crear paciente inyectando campos no permitidos (created_by, id) los ignora', async () => {
    const res = await request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({
        id: '11111111-1111-1111-1111-111111111111',
        nombre: 'Allowlist',
        apellido: 'Test',
        dni: '99887766',
        fecha_nacimiento: '2000-01-01',
        created_by: '00000000-0000-0000-0000-000000000000' // no debe poder falsear esto
      });

    if (res.status === 201) {
      // El ID inyectado no debe haber sido respetado
      expect(res.body.id).not.toBe('11111111-1111-1111-1111-111111111111');
      // created_by debe ser el profesional autenticado, no el inyectado
      expect(res.body.created_by).toBe(fausto.profesional.id);

      // Limpieza: soft-delete del paciente de test recién creado
      await request(app)
        .delete(`/api/pacientes/${res.body.id}`)
        .set('Authorization', `Bearer ${fausto.token}`);
    } else {
      // Si el DNI ya existía de una corrida anterior, al menos confirmar que no rompió con 500
      expect(res.status).not.toBe(500);
    }
  });

  test('PATCH con estado fuera del enum permitido da 422', async () => {
    const listado = await request(app)
      .get('/api/pacientes')
      .set('Authorization', `Bearer ${fausto.token}`);

    if (listado.body.data.length === 0) {
      console.warn('Sin pacientes para testear PATCH — saltando caso');
      return;
    }

    const res = await request(app)
      .patch(`/api/pacientes/${listado.body.data[0].id}`)
      .set('Authorization', `Bearer ${fausto.token}`)
      .send({ estado: 'estado_invalido_que_no_existe' });

    expect(res.status).toBe(422);
  });
});
