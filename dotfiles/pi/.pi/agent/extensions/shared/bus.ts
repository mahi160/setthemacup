const _target = new EventTarget();

type BusEvent = Event & { data: unknown };

export const bus = {
  emit(type: string, data: unknown): void {
    const e = Object.assign(new Event(type), { data });
    _target.dispatchEvent(e);
  },

  on(type: string, cb: (data: unknown) => void): () => void {
    const handler = (e: Event) => cb((e as BusEvent).data);
    _target.addEventListener(type, handler);
    return () => _target.removeEventListener(type, handler);
  },
};
