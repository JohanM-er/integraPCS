import { WorkPackageProjectionPipeline, WorkPackageReadModel } from '../../application/projections/WorkPackageProjectionPipeline';
import { DomainEvent } from '../../domain/events/DomainEvents';

// Very simple in-memory projection sink
export class InMemoryWorkPackageProjectionSink {
  private readonly store = new Map<string, WorkPackageReadModel>();

  async upsert(id: string, doc: WorkPackageReadModel): Promise<void> {
    this.store.set(id, doc);
  }

  get(id: string): WorkPackageReadModel | undefined {
    return this.store.get(id);
  }
}

export class WorkPackageRepository {
  private readonly sink: InMemoryWorkPackageProjectionSink;
  private readonly pipeline: WorkPackageProjectionPipeline;

  constructor() {
    this.sink = new InMemoryWorkPackageProjectionSink();
    this.pipeline = new WorkPackageProjectionPipeline(this.sink);
  }

  async project(events: DomainEvent[]): Promise<void> {
    await this.pipeline.project(events);
  }

  async getReadModel(id: string): Promise<WorkPackageReadModel | undefined> {
    return this.sink.get(id);
  }
}


