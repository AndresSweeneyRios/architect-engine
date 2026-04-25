export class TypedEmitter<Events extends { [key: string]: (...args: any[]) => void }
> {
  private listeners: { [K in keyof Events]?: Events[K][] } = {};

  on<K extends keyof Events>(eventName: K, listener: Events[K]): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(listener);
  }

  off<K extends keyof Events>(eventName: K, listener: Events[K]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName]!.filter(l => l !== listener);
  }

  emit<K extends keyof Events>(eventName: K, ...args: Parameters<Events[K]>): void {
    this.listeners[eventName]?.forEach(listener => listener(...args));
  }
}
