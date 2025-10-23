import { WorkPackageCommandHandler } from '@contexts/work-package/application/commandHandlers/WorkPackageCommandHandler';
import { Neo4jEventStore } from '@contexts/work-package/infrastructure/persistence/event-store/Neo4jEventStore';
import { WorkPackageRepository } from '@contexts/work-package/infrastructure/persistence/projections/WorkPackageRepository';
import { requireRole, type AuthLikeContext } from './directives/authDirective';

// In-memory singletons for POC
const eventStore = new Neo4jEventStore();
const repo = new WorkPackageRepository();
const handler = new WorkPackageCommandHandler(eventStore);

type Ctx = AuthLikeContext & Record<string, unknown>;

export const resolvers = {
  Query: {
    workPackage: async (_: unknown, args: { id: string }, _ctx: Ctx) => {
      return repo.getReadModel(args.id);
    }
  },
  Mutation: {
    createWorkPackage: requireRole('user')(async (_: unknown, args: { id: string; name: string }, _ctx: Ctx) => {
      const events = await handler.handle({
        type: 'CreateWorkPackage',
        workPackageId: args.id,
        name: args.name
      });
      await repo.project(events);
      return events.map(e => ({ type: e.type }));
    }),
    addTask: requireRole('user')(async (_: unknown, args: { workPackageId: string; taskId: string; title: string; estimateHours?: number }, _ctx: Ctx) => {
      const events = await handler.handle({
        type: 'AddTask',
        workPackageId: args.workPackageId,
        taskId: args.taskId,
        title: args.title,
        estimateHours: args.estimateHours
      });
      await repo.project(events);
      return events.map(e => ({ type: e.type }));
    }),
    reportDailyProgress: requireRole('user')(async (_: unknown, args: { workPackageId: string; taskId?: string; percent?: number; notes?: string }, _ctx: Ctx) => {
      const events = await handler.handle({
        type: 'ReportDailyProgress',
        workPackageId: args.workPackageId,
        taskId: args.taskId,
        percent: args.percent,
        notes: args.notes
      });
      await repo.project(events);
      return events.map(e => ({ type: e.type }));
    })
  }
};