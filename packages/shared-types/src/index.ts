/**
 * Shared types for integraPCS event-sourced system
 * These types are consumed by both backend and frontend.
 */

/** Generic identifier types */
export type UUID = string;
export type ISODateString = string;

/**
 * DomainEvent
 * - id: Unique event id
 * - aggregateId: ID of aggregate the event belongs to
 * - type: Event name
 * - data: Event payload (typed)
 * - version: Aggregate version after this event
 * - ts: ISO timestamp when the event occurred
 */
export interface DomainEvent<TPayload = unknown> {
  id: UUID;
  aggregateId: UUID;
  type: string;
  data: TPayload;
  version: number;
  ts: ISODateString;
}

/**
 * Optional event metadata useful for tracing and auditing
 */
export interface EventMetadata {
  userId?: UUID;
  correlationId?: UUID;
  causationId?: UUID;
}

/**
 * StoredEvent is a DomainEvent with optional metadata attached
 */
export type StoredEvent<TPayload = unknown> = DomainEvent<TPayload> & {
  metadata?: EventMetadata;
};

/**
 * Event type names used across the system
 */
export const EVENT_WORK_PACKAGE_CREATED = 'WorkPackageCreated' as const;
export const EVENT_TASK_PROGRESS_UPDATED = 'TaskProgressUpdated' as const;

export const EVENT_TYPES = {
  WorkPackageCreated: EVENT_WORK_PACKAGE_CREATED,
  TaskProgressUpdated: EVENT_TASK_PROGRESS_UPDATED
} as const;

export type EventTypeName = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

/**
 * WorkPackageCreated event
 */
export interface WorkPackageCreatedPayload {
  workPackageId: UUID;
  name: string;
  projectId: UUID;
  createdBy: UUID;
  createdAt: ISODateString;
}

export type WorkPackageCreatedEvent = DomainEvent<WorkPackageCreatedPayload> & {
  type: typeof EVENT_WORK_PACKAGE_CREATED;
};

/**
 * TaskProgressUpdated event
 */
export interface TaskProgressUpdatedPayload {
  workPackageId: UUID;
  taskId: UUID;
  remainingHours: number;
  reportedBy: UUID;
  reportedAt: ISODateString;
}

export type TaskProgressUpdatedEvent = DomainEvent<TaskProgressUpdatedPayload> & {
  type: typeof EVENT_TASK_PROGRESS_UPDATED;
};

/**
 * Union of Work Package domain events provided here as examples.
 * Extend this union as more events are added to the context.
 */
export type WorkPackageDomainEvent =
  | WorkPackageCreatedEvent
  | TaskProgressUpdatedEvent;

/**
 * Simple read-model shapes (optional) for convenience across UI and server
 */
export interface Task {
  id: UUID;
  name: string;
  plannedHours: number;
  remainingHours: number;
}

export interface WorkPackage {
  id: UUID;
  name: string;
  projectId: UUID;
  tasks: Task[];
}