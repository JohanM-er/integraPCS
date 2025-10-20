import { DomainEvent } from '../../domain/events/DomainEvents';

export interface ProjectionSink<TDoc> {
  upsert(id: string, doc: TDoc): Promise<void>;
}

export interface WorkPackageReadModel {
  id: string;
  name: string;
  tasks: Array<{ id: string; title: string; status: string }>;
  lastUpdatedAt: string;
}

export class WorkPackageProjectionPipeline {
  private readonly sink: ProjectionSink<WorkPackageReadModel>;

  constructor(sink: ProjectionSink<WorkPackageReadModel>) {
    this.sink = sink;
  }

  async project(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const workPackageId = events[0]!.workPackageId;

    // Very naive in-memory style projection doc build
    const doc: WorkPackageReadModel = {
      id: workPackageId,
      name: '',
      tasks: [],
      lastUpdatedAt: new Date().toISOString(),
    };

    for (const evt of events) {
      switch (evt.type) {
        case 'WorkPackageCreated':
          doc.name = evt.name;
          doc.lastUpdatedAt = evt.createdAt;
          break;
        case 'TaskAdded':
          doc.tasks.push({ id: evt.taskId, title: evt.title, status: 'todo' });
          doc.lastUpdatedAt = evt.addedAt;
          break;
        case 'DailyProgressReported':
          if (evt.taskId) {
            const t = doc.tasks.find(x => x.id === evt.taskId);
            if (t) {
              if (typeof evt.percent === 'number' && evt.percent >= 100) t.status = 'done';
              else t.status = 'in_progress';
            }
          }
          doc.lastUpdatedAt = evt.reportedAt;
          break;
      }
    }

    await this.sink.upsert(workPackageId, doc);
  }
}


