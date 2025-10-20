import { Task } from './Task';
import { Command, CreateWorkPackageCommand, AddTaskCommand, ReportDailyProgressCommand } from './commands/Commands';
import { DomainEvent, WorkPackageCreated, TaskAdded, DailyProgressReported } from './events/DomainEvents';

export class WorkPackageAggregate {
  readonly id: string;
  name: string;
  tasks: Task[];

  constructor(params: { id: string; name: string; tasks?: Task[] }) {
    this.id = params.id;
    this.name = params.name;
    this.tasks = params.tasks ?? [];
  }

  static rehydrateFrom(eventStream: DomainEvent[]): WorkPackageAggregate | null {
    if (eventStream.length === 0) return null;
    let aggregate: WorkPackageAggregate | null = null;
    for (const event of eventStream) {
      if (!aggregate) {
        if (event.type !== 'WorkPackageCreated') return null;
        aggregate = new WorkPackageAggregate({ id: event.workPackageId, name: event.name, tasks: [] });
        continue;
      }
      aggregate.apply(event);
    }
    return aggregate;
  }

  execute(command: Command): DomainEvent[] {
    switch (command.type) {
      case 'CreateWorkPackage':
        return this.handleCreateWorkPackage(command);
      case 'AddTask':
        return this.handleAddTask(command);
      case 'ReportDailyProgress':
        return this.handleReportDailyProgress(command);
      default: {
        const neverCommand: never = command;
        throw new Error(`Unsupported command: ${(neverCommand as unknown) as string}`);
      }
    }
  }

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'WorkPackageCreated':
        this.name = event.name;
        break;
      case 'TaskAdded':
        this.tasks.push({ id: event.taskId, title: event.title, estimateHours: event.estimateHours, status: 'todo' });
        break;
      case 'DailyProgressReported':
        if (event.taskId) {
          const task = this.tasks.find(t => t.id === event.taskId);
          if (task && typeof event.percent === 'number' && event.percent >= 100) {
            task.status = 'done';
          } else if (task) {
            task.status = 'in_progress';
          }
        }
        break;
      default: {
        const neverEvent: never = event;
        throw new Error(`Unsupported event: ${(neverEvent as unknown) as string}`);
      }
    }
  }

  private handleCreateWorkPackage(cmd: CreateWorkPackageCommand): DomainEvent[] {
    if (this.id) {
      throw new Error('WorkPackage already exists');
    }
    const event: WorkPackageCreated = {
      type: 'WorkPackageCreated',
      workPackageId: cmd.workPackageId,
      name: cmd.name,
      createdAt: new Date().toISOString(),
    };
    return [event];
  }

  private handleAddTask(cmd: AddTaskCommand): DomainEvent[] {
    const exists = this.tasks.some(t => t.id === cmd.taskId);
    if (exists) {
      throw new Error('Task already exists');
    }
    const event: TaskAdded = {
      type: 'TaskAdded',
      workPackageId: cmd.workPackageId,
      taskId: cmd.taskId,
      title: cmd.title,
      estimateHours: cmd.estimateHours,
      addedAt: new Date().toISOString(),
    };
    return [event];
  }

  private handleReportDailyProgress(cmd: ReportDailyProgressCommand): DomainEvent[] {
    const event: DailyProgressReported = {
      type: 'DailyProgressReported',
      workPackageId: cmd.workPackageId,
      taskId: cmd.taskId,
      percent: cmd.percent,
      notes: cmd.notes,
      reportedAt: new Date().toISOString(),
    };
    return [event];
  }
}


