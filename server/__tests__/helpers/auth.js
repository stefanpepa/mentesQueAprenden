const request = require('supertest');
const app = require('../../src/index');

// Credenciales de las 3 cuentas de prueba usadas durante todo el desarrollo.
// Fausto y Stefano son admin, Juan Cruz es profesional sin pacientes propios —
// perfecto para testear que NO ve los pacientes ajenos.
const CUENTAS = {
  fausto: { email: 'faustozaccanti@gmail.com', password: 'PeterParker2002gg' },
  stefano: { email: 'stefanomastrangelobruno@gmail.com', password: 'PeterParker2002gg' },
  juanCruz: { email: 'juancruzrodriguez@gmail.com', password: 'sigmaboytoilet' }
};

async function loginComo(nombreCuenta) {
  const cuenta = CUENTAS[nombreCuenta];
  if (!cuenta) throw new Error(`Cuenta de prueba desconocida: ${nombreCuenta}`);

  const res = await request(app).post('/api/auth/login').send(cuenta);
  if (res.status !== 200) {
    throw new Error(`Login falló para ${nombreCuenta}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.session.access_token,
    profesional: res.body.profesional
  };
}

module.exports = { loginComo, CUENTAS };
