import { type EventStorePort } from '@shared/patterns';
import { type Command } from '../../domain/commands/Commands';
import { type DomainEvent } from '../../domain/events/DomainEvents';
import { WorkPackageAggregate } from '../../domain/WorkPackageAggregate';

export class WorkPackageCommandHandler {
  private readonly eventStore: EventStorePort<DomainEvent>;

  constructor(eventStore: EventStorePort<DomainEvent>) {
    this.eventStore = eventStore;
  }

  async handle(command: Command): Promise<DomainEvent[]> {
    const workPackageId =
      (command as any).workPackageId ?? (command.type === 'CreateWorkPackage' ? (command as any).workPackageId : undefined);

    if (!workPackageId) {
      throw new Error('Command missing workPackageId');
    }

    const history = await this.eventStore.load(workPackageId);
    const aggregate =
      WorkPackageAggregate.rehydrateFrom(history) ?? new WorkPackageAggregate({ id: workPackageId, name: '' });

    const newEvents = aggregate.execute(command);

    // Apply events to the aggregate to update state
    for (const evt of newEvents) {
      aggregate.apply(evt);
    }

    await this.eventStore.append(workPackageId, newEvents);
    return newEvents;
  }
}