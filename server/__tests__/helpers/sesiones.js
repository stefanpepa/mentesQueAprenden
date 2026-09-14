const request = require('supertest');
const app = require('../../src/index');
const { CUENTAS } = require('./auth');

// Cachea las sesiones logueadas en memoria del proceso de test para toda la
// corrida — el login pasa por el rate limiter real de /api/auth (10
// intentos/15min), así que loguear una vez por archivo de test lo agota
// rápido. Con esto, cada cuenta se loguea como máximo una vez por proceso.
const cache = {};

async function obtenerSesion(nombreCuenta) {
  if (cache[nombreCuenta]) return cache[nombreCuenta];

  const cuenta = CUENTAS[nombreCuenta];
  if (!cuenta) throw new Error(`Cuenta de prueba desconocida: ${nombreCuenta}`);

  const res = await request(app).post('/api/auth/login').send(cuenta);
  if (res.status !== 200) {
    throw new Error(`Login falló para ${nombreCuenta}: ${res.status} ${JSON.stringify(res.body)}`);
  }

  cache[nombreCuenta] = {
    token: res.body.session.access_token,
    profesional: res.body.profesional
  };
  return cache[nombreCuenta];
}

module.exports = { obtenerSesion };
