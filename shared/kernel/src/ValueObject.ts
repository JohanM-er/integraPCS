export abstract class ValueObject<T> {
  public readonly props: Readonly<T>;

  protected constructor(props: T) {
    this.props = Object.freeze({ ...(props as any) }) as Readonly<T>;
  }

  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false;
    if (vo === this) return true;

    try {
      return JSON.stringify(this.props) === JSON.stringify(vo.props);
    } catch {
      return false;
    }
  }
}