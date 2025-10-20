// Placeholder RabbitMQ service for publishing domain events
import { DomainEvent } from '../../domain/events/DomainEvents';

export class RabbitMQService {
  async publish(_streamId: string, _events: DomainEvent[]): Promise<void> {
    // No-op placeholder
  }
}


