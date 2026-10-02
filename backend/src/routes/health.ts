import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return { status: 'ok', service: 'seti-api', version: '0.1.0' };
  });
}
