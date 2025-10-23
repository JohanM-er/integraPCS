export interface EventStorePort<TEvent = unknown> {
  load(streamId: string): Promise<TEvent[]>;
  append(streamId: string, events: TEvent[]): Promise<void>;
}

export interface ProjectionSinkPort<TDoc> {
  upsert(id: string, doc: TDoc): Promise<void>;
}

export interface OutboxPort<TEvent = unknown, TMeta = unknown> {
  append(streamId: string, events: TEvent[], metadata?: TMeta): Promise<void>;
}

export interface MessagingPort<TEvent = unknown> {
  publish(streamId: string, events: TEvent[]): Promise<void>;
}

export interface PubSubPort<TPayload = unknown> {
  publish(topic: string, payload: TPayload): Promise<void>;
}