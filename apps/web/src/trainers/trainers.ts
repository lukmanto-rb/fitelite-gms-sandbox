// FIT-941 Trainers page: copy, validation and the trainers API client.
//
// Interim behaviour while OQ-001 to OQ-004 are open (not decisions; see docs/trainers.md):
// - OQ-001: Speciality is one required free-text input (SPECIALITY_CONTROL below).
// - OQ-002: whoever the gateway signs in for the workspace may view and add (no role check here).
// - OQ-003: rows are shown in the order the server returns them; no sort is applied or promised.
// - OQ-004: no matching-name rule or message; only one add attempt = one record (attempt key).

/** Exact PRD v1.0 copy. */
export const COPY = {
  nav: 'Trainers',
  heading: 'Trainers',
  intro: 'Add trainers and view all trainers.',
  formHeading: 'Add trainer',
  required: 'Both fields are required.',
  nameLabel: 'Name',
  nameHelper: 'Maximum 100 characters.',
  specialityLabel: 'Speciality',
  submit: 'Add trainer',
  adding: 'Adding…',
  retrySave: 'Try again',
  nameRequired: 'Enter a name.',
  specialityRequired: 'Enter a speciality.',
  nameTooLong: 'Use 100 characters or fewer.',
  listHeading: 'All trainers',
  colName: 'Name',
  colSpeciality: 'Speciality',
  loading: 'Loading trainers…',
  empty: 'No trainers yet',
  emptyHint: 'Add your first trainer using the form.',
  loadError: "Couldn't load trainers. Try again.",
  retryLoad: 'Try again',
  added: 'Trainer added.',
  saveError: "Couldn't confirm the trainer was added. Your entries are kept.",
} as const;

export const NAME_MAX = 100;

/** OQ-001 undecided: a provisional free-text input. Change here when Rian decides. */
export const SPECIALITY_CONTROL = 'text' as const;

export type Trainer = { id: string; name: string; speciality: string };

export type FieldError = 'required' | 'too_long';
export type FieldErrors = { name?: FieldError; speciality?: FieldError };

/** Characters as people count them (code points), matching the trainers service. */
const charCount = (s: string) => Array.from(s).length;

/** FR-004, FR-005, BR-003: trims surrounding whitespace only; keeps case, punctuation and accents. */
export function validateTrainer(name: string, speciality: string):
  | { ok: true; name: string; speciality: string }
  | { ok: false; errors: FieldErrors } {
  const n = name.trim();
  const s = speciality.trim();
  const errors: FieldErrors = {};
  if (!n) errors.name = 'required';
  else if (charCount(n) > NAME_MAX) errors.name = 'too_long';
  if (!s) errors.speciality = 'required';
  return errors.name || errors.speciality ? { ok: false, errors } : { ok: true, name: n, speciality: s };
}

export const fieldErrorText = (field: 'name' | 'speciality', error: FieldError) =>
  error === 'too_long' ? COPY.nameTooLong : field === 'name' ? COPY.nameRequired : COPY.specialityRequired;

/** A fresh key for one add attempt; reused unchanged by its retries (FR-008). */
export function newAttemptKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- API client (relative paths through the gateway; never absolute URLs) ----

export const TRAINERS_URL = 'api/trainers/trainers';
/** A save that has not answered by then is treated as unconfirmed; an unchanged retry is safe. */
export const SAVE_TIMEOUT_MS = 15000;

export type ErrorCategory = 'connectivity' | 'permission' | 'service';

export type AddResult =
  | { ok: true; trainer: Trainer }
  /** failure: the server answered that nothing was saved; unconfirmed: the outcome is unknown. */
  | { ok: false; result: 'failure' | 'unconfirmed'; category: ErrorCategory };

export type TrainersApi = {
  list: () => Promise<Trainer[]>;
  add: (input: { name: string; speciality: string }, attemptKey: string) => Promise<AddResult>;
};

const isTrainer = (t: unknown): t is Trainer =>
  !!t && typeof t === 'object' &&
  typeof (t as Trainer).id === 'string' && typeof (t as Trainer).name === 'string' && typeof (t as Trainer).speciality === 'string';

export function createTrainersApi(fetchImpl: typeof fetch = (...a) => globalThis.fetch(...a), timeoutMs = SAVE_TIMEOUT_MS): TrainersApi {
  return {
    async list() {
      const res = await fetchImpl(TRAINERS_URL, { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('load_failed');
      const body = (await res.json()) as { trainers?: unknown };
      if (!Array.isArray(body.trainers) || !body.trainers.every(isTrainer)) throw new Error('load_failed');
      return body.trainers;
    },
    async add(input, attemptKey) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(TRAINERS_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': attemptKey },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
      } catch {
        return { ok: false, result: 'unconfirmed', category: 'connectivity' };
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401 || res.status === 403) return { ok: false, result: 'failure', category: 'permission' };
      if (res.status >= 500) return { ok: false, result: 'unconfirmed', category: 'service' };
      if (!res.ok) return { ok: false, result: 'failure', category: 'service' };
      try {
        const body = (await res.json()) as { trainer?: unknown };
        if (isTrainer(body.trainer)) return { ok: true, trainer: body.trainer };
      } catch {
        // fall through: the save may have happened but we cannot confirm it
      }
      return { ok: false, result: 'unconfirmed', category: 'service' };
    },
  };
}
