/**
 * Domain event definitions for the Work Package POC
 */

export type WorkPackageCreated = {
  type: 'WorkPackageCreated';
  workPackageId: string;
  name: string;
  createdAt: string; // ISO string
};

export type TaskAdded = {
  type: 'TaskAdded';
  workPackageId: string;
  taskId: string;
  title: string;
  estimateHours?: number;
  addedAt: string; // ISO string
};

export type DailyProgressReported = {
  type: 'DailyProgressReported';
  workPackageId: string;
  taskId?: string;
  percent?: number;
  notes?: string;
  reportedAt: string; // ISO string
};

export type DomainEvent =
  | WorkPackageCreated
  | TaskAdded
  | DailyProgressReported;