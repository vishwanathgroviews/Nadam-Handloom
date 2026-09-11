import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { startRateLimitCleanup } from './middleware/rateLimit.middleware';
import { startReservationExpirySweep } from './modules/inventory/inventory.service';
import { startEventDispatchSweep } from './modules/events/events.service';
import { startRetentionSweep } from './modules/retention/retention.service';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the database');

    startRateLimitCleanup();
    startReservationExpirySweep();
    startEventDispatchSweep();
    startRetentionSweep();

    const server = app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });

    // Container platforms (App Runner, ECS, Kubernetes) send SIGTERM and then
    // kill the process a short while later. Without this, every deploy cuts
    // whatever was in flight — mid-checkout requests included. Stop accepting
    // new connections, let the open ones finish, then close the pool.
    const shutdown = (signal: string) => {
      console.log(`${signal} received — shutting down`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
      // Don't hang forever on a stuck connection.
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
