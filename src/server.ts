import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.PORT, () => {
  console.log(`home-api escuchando en el puerto ${config.PORT} (${config.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Recibido ${signal}, cerrando...`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
