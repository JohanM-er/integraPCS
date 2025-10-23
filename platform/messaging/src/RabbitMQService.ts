/**
 * Placeholder RabbitMQ service for publishing domain events.
 * Real implementation should use amqplib and robust connection/channel management.
 */
export class RabbitMQService {
  async publish(_streamId: string, _events: unknown[]): Promise<void> {
    // No-op placeholder
  }
}