const app = require('./index');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
});
