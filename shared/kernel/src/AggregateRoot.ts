import { Entity } from './Entity';

export abstract class AggregateRoot<TProps> extends Entity<TProps> {
  private _domainEvents: unknown[] = [];

  get domainEvents(): readonly unknown[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: unknown): void {
    this._domainEvents.push(event);
    this.logDomainEventAdded(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  protected logDomainEventAdded(_event: unknown): void {
    // Hook for logging when needed
  }
}