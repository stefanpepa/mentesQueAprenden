require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const sesionesRoutes = require('./routes/sesiones');
const derivacionesRoutes = require('./routes/derivaciones');
const archivosRoutes = require('./routes/archivos');
const profesionalesRoutes = require('./routes/profesionales');
const obrasSocialesRoutes = require('./routes/obrasSociales');
const turnosRoutes = require('./routes/turnos');
const pagosRoutes = require('./routes/pagos');
const iaRoutes = require('./routes/ia');
const { iniciarReminderJob } = require('./services/reminderJob');

const app = express();
const PORT = process.env.PORT || 3001;

// Seguridad
app.use(helmet());
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo más tarde' }
});
app.use(limiter);

// Rate limiting estricto para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login' }
});

// Parseo
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/sesiones', sesionesRoutes);
app.use('/api/derivaciones', derivacionesRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/profesionales', profesionalesRoutes);
app.use('/api/obras-sociales', obrasSocialesRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/ia', iaRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
  if (process.env.NODE_ENV !== 'test') iniciarReminderJob();
});

module.exports = app;
