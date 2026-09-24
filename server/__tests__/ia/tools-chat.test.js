const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../src/index');
const iaService = require('../../src/services/IAService');
const { obtenerSesion } = require('../helpers/sesiones');

// Las tools de lectura del chat tienen que devolver exactamente lo mismo que
// ve el profesional en la app. Antes consultaban con supabaseAdmin (sin RLS):
// buscar_pacientes necesitaba un texto y el modelo a veces mandaba " " (0
// resultados), y ver_agenda mostraba los turnos de TODOS los profesionales.
// Estos tests ejecutan las tools directo, sin pasar por el modelo de IA.

function clienteComo(sesion) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sesion.token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

describe('Tools de lectura del chat IA', () => {
  let fausto;
  let juanCruz;

  beforeAll(async () => {
    fausto = await obtenerSesion('fausto');
    juanCruz = await obtenerSesion('juanCruz');
  });

  test('listar_mis_pacientes devuelve los mismos pacientes que GET /api/pacientes', async () => {
    for (const sesion of [fausto, juanCruz]) {
      const res = await request(app)
        .get('/api/pacientes?limit=100')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(res.status).toBe(200);

      const resultado = await iaService.ejecutarTool('listar_mis_pacientes', {}, sesion.profesional, clienteComo(sesion));

      expect(resultado.total).toBe(res.body.pagination.total);
      expect(resultado.pacientes.map(p => p.id).sort()).toEqual(res.body.data.map(p => p.id).sort());
    }
  });

  test('ver_agenda solo devuelve turnos propios, con la hora ya en formato local', async () => {
    // Rango amplio para que haya turnos de varios profesionales en la base
    const args = { fecha: '2020-01-01', fecha_hasta: '2030-12-31' };

    const todos = await request(app)
      .get('/api/turnos?fecha_inicio=2020-01-01T00:00:00-03:00&fecha_fin=2030-12-31T23:59:59-03:00')
      .set('Authorization', `Bearer ${fausto.token}`);
    expect(todos.status).toBe(200);
    const idsPropios = todos.body.filter(t => !t.ocupado).map(t => t.id).sort();

    const resultado = await iaService.ejecutarTool('ver_agenda', args, fausto.profesional, clienteComo(fausto));

    expect(resultado.turnos.map(t => t.id).sort()).toEqual(idsPropios);
    for (const turno of resultado.turnos) {
      expect(turno.inicio).not.toMatch(/T\d{2}:\d{2}/); // no ISO/UTC crudo
    }
  });

  test('listar_mis_sesiones separa futuras y pasadas y solo trae las propias', async () => {
    const ahora = new Date().toISOString();
    const db = clienteComo(fausto);

    const resultado = await iaService.ejecutarTool('listar_mis_sesiones', {}, fausto.profesional, db);

    // Futuras = exactamente los turnos propios no cancelados desde ahora
    const { data: turnosFuturos } = await db
      .from('turnos')
      .select('id')
      .eq('profesional_id', fausto.profesional.id)
      .neq('estado', 'cancelado')
      .gte('fecha_inicio', ahora);
    expect(resultado.futuras.map(t => t.id).sort()).toEqual(turnosFuturos.map(t => t.id).sort());

    // Pasadas registradas = sesiones propias ya ocurridas (hasta el tope de 20)
    const { data: sesionesPasadas } = await db
      .from('sesiones')
      .select('id')
      .eq('profesional_id', fausto.profesional.id)
      .lte('fecha', ahora);
    const idsSesiones = new Set(sesionesPasadas.map(s => s.id));
    for (const s of resultado.pasadas.filter(s => s.registrada)) {
      expect(idsSesiones.has(s.id)).toBe(true);
    }

    // Un turno no puede aparecer a la vez como futuro y como pasado
    const idsFuturos = new Set(resultado.futuras.map(t => t.id));
    expect(resultado.pasadas.some(s => idsFuturos.has(s.id))).toBe(false);
  });

  test('listar_mis_sesiones con paciente_id solo trae las de ese paciente', async () => {
    const db = clienteComo(fausto);
    const { pacientes } = await iaService.ejecutarTool('listar_mis_pacientes', {}, fausto.profesional, db);
    if (pacientes.length === 0) return;
    const paciente = pacientes[0];
    const nombre = `${paciente.nombre} ${paciente.apellido}`;

    const resultado = await iaService.ejecutarTool('listar_mis_sesiones', { paciente_id: paciente.id }, fausto.profesional, db);

    for (const s of [...resultado.futuras, ...resultado.pasadas]) {
      expect(s.paciente).toBe(nombre);
    }
  });

  test('ver_agenda rechaza fechas con formato inválido', async () => {
    await expect(
      iaService.ejecutarTool('ver_agenda', { fecha: 'mañana' }, fausto.profesional, clienteComo(fausto))
    ).rejects.toThrow(/fecha inválida/);
  });
});
