import type { AddResult, Trainer, TrainersApi } from './trainers';

type Deferred<T> = { resolve: (v: T) => void; reject: (e: unknown) => void };

/** A TrainersApi whose calls stay pending until the test settles them. */
export function controlledApi() {
  const lists: Deferred<Trainer[]>[] = [];
  const adds: (Deferred<AddResult> & { input: { name: string; speciality: string }; key: string })[] = [];
  const api: TrainersApi = {
    list: vi.fn(() => new Promise<Trainer[]>((resolve, reject) => lists.push({ resolve, reject }))),
    add: vi.fn(
      (input: { name: string; speciality: string }, key: string) =>
        new Promise<AddResult>((resolve, reject) => adds.push({ resolve, reject, input, key })),
    ),
  };
  return { api, lists, adds };
}

/**
 * An in-memory stand-in for the trainers service: one record per attempt key, like the real
 * service. `loseConfirmation` saves but answers as if the connection dropped.
 */
export function fakeServer(initial: Trainer[] = []) {
  const records = [...initial];
  const byKey = new Map<string, Trainer>();
  let next = initial.length + 1;
  const behaviour = { loseConfirmation: false, failNext: false };
  const api: TrainersApi = {
    list: vi.fn(async () => records.map((r) => ({ ...r }))),
    add: vi.fn(async (input, key): Promise<AddResult> => {
      if (behaviour.failNext) {
        behaviour.failNext = false;
        return { ok: false, result: 'unconfirmed', category: 'connectivity' };
      }
      let rec = byKey.get(key);
      if (!rec) {
        rec = { id: String(next++), name: input.name, speciality: input.speciality };
        byKey.set(key, rec);
        records.push(rec);
      }
      if (behaviour.loseConfirmation) {
        behaviour.loseConfirmation = false;
        return { ok: false, result: 'unconfirmed', category: 'connectivity' };
      }
      return { ok: true, trainer: { ...rec } };
    }),
  };
  return { api, records, behaviour };
}
