import { type EventStorePort } from '@shared/patterns';
import { type DomainEvent } from '../../../domain/events/DomainEvents';

/**
 * Placeholder in-memory event store; swap with Neo4j later.
 */
export class Neo4jEventStore implements EventStorePort<DomainEvent> {
  private readonly streams = new Map<string, DomainEvent[]>();

  async load(workPackageId: string): Promise<DomainEvent[]> {
    return this.streams.get(workPackageId) ?? [];
  }

  async append(workPackageId: string, events: DomainEvent[]): Promise<void> {
    const existing = this.streams.get(workPackageId) ?? [];
    this.streams.set(workPackageId, [...existing, ...events]);
  }
}