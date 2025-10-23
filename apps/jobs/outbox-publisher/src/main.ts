/**
 * Outbox Publisher Worker
 * This stub runs indefinitely and logs heartbeat messages.
 * Real implementation should read an Outbox and publish to RabbitMQ.
 */

function main(): void {
  // Heartbeat every 10 seconds
  const interval = setInterval(() => {
    // eslint-disable-next-line no-console
    console.log(`[outbox-publisher] heartbeat @ ${new Date().toISOString()}`);
  }, 10_000);

  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log('[outbox-publisher] shutting down');
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // eslint-disable-next-line no-console
  console.log('[outbox-publisher] started');
}

main();