export abstract class Entity<TProps> {
  public readonly id: string;
  protected readonly props: TProps;

  protected constructor(id: string, props: TProps) {
    this.id = id;
    this.props = props;
  }

  equals(object?: Entity<unknown>): boolean {
    if (object === null || object === undefined) return false;
    if (this === object) return true;
    return this.id === object.id;
  }
}