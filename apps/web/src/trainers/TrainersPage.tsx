import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import './TrainersPage.css';
import {
  COPY,
  SPECIALITY_CONTROL,
  createTrainersApi,
  fieldErrorText,
  newAttemptKey,
  validateTrainer,
  type FieldErrors,
  type Trainer,
  type TrainersApi,
} from './trainers';
import {
  addResultEvent,
  loadResultEvent,
  noopTrainersAnalytics,
  submittedEvent,
  validationFailedEvent,
  type LoadType,
  type TrainersAnalyticsSink,
} from './analytics';

/**
 * FIT-941 Trainers page. The eight PRD/prototype states map to:
 * - Trainers / Loading:          list.status 'loading' (form shown but disabled)
 * - Trainers / List / Empty:     list.status 'ready' with / without rows
 * - Trainers / Load Error:       list.status 'error' (form disabled, list "Try again")
 * - Trainers / Validation Error: errors set after a blocked submission
 * - Trainers / Adding:           save 'saving' (controls disabled, no unconfirmed row)
 * - Trainers / Success:          save 'success' ("Trainer added.", form cleared)
 * - Trainers / Save Error:       save 'error' (values kept, submit becomes "Try again")
 */
type ListState = { status: 'loading' } | { status: 'ready'; trainers: Trainer[] } | { status: 'error' };
type SaveState = 'idle' | 'saving' | 'success' | 'error';
/** The last add attempt that did not confirm: an unchanged retry reuses its key (FR-008). */
type PendingAttempt = { key: string; name: string; speciality: string };

export type TrainersPageProps = {
  api?: TrainersApi;
  analytics?: TrainersAnalyticsSink;
};

const defaultApi = createTrainersApi();

export default function TrainersPage({ api = defaultApi, analytics = noopTrainersAnalytics }: TrainersPageProps) {
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [save, setSave] = useState<SaveState>('idle');

  const deps = useRef({ api, analytics });
  deps.current = { api, analytics };
  const mounted = useRef(false);
  const loading = useRef(false);
  const saving = useRef(false);
  const pending = useRef<PendingAttempt | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const specialityRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const ids = useId();
  const id = (part: string) => `${ids}-${part}`;

  // FR-011, FR-014: one retrieval at a time; loading never shows an empty-list conclusion.
  const load = useCallback((loadType: LoadType) => {
    if (loading.current) return;
    loading.current = true;
    setList({ status: 'loading' });
    let promise: Promise<Trainer[]>;
    try {
      promise = deps.current.api.list();
    } catch (e) {
      promise = Promise.reject(e);
    }
    promise.then(
      (trainers) => {
        loading.current = false;
        if (!mounted.current) return;
        setList({ status: 'ready', trainers });
        deps.current.analytics(loadResultEvent(loadType, trainers.length));
      },
      () => {
        loading.current = false;
        if (!mounted.current) return;
        setList({ status: 'error' });
        deps.current.analytics(loadResultEvent(loadType, null));
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    load('initial');
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Controls are disabled while saving, which drops keyboard focus; put it back on the action.
  useEffect(() => {
    if (save === 'saving' || !restoreFocus.current) return;
    restoreFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) submitRef.current?.focus();
  }, [save]);

  const formDisabled = list.status !== 'ready' || save === 'saving';

  const onEdit = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    // "Trainer added." clears when the form is edited again.
    if (save === 'success') setSave('idle');
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving.current || list.status !== 'ready') return;

    const valid = validateTrainer(name, speciality);
    if (!valid.ok) {
      setErrors(valid.errors);
      if (save === 'success') setSave('idle');
      deps.current.analytics(validationFailedEvent(valid.errors));
      (valid.errors.name ? nameRef : specialityRef).current?.focus();
      return;
    }
    setErrors({});

    const prior = pending.current;
    const unchangedRetry = !!prior && prior.name === valid.name && prior.speciality === valid.speciality;
    const attempt: PendingAttempt = unchangedRetry ? prior! : { key: newAttemptKey(), name: valid.name, speciality: valid.speciality };
    const submissionType = unchangedRetry ? 'retry' : 'initial';

    saving.current = true;
    setSave('saving');
    deps.current.analytics(submittedEvent(submissionType));

    let result: Awaited<ReturnType<TrainersApi['add']>>;
    try {
      result = await deps.current.api.add({ name: attempt.name, speciality: attempt.speciality }, attempt.key);
    } catch {
      result = { ok: false, result: 'unconfirmed', category: 'connectivity' };
    }
    saving.current = false;
    if (!mounted.current) return;
    restoreFocus.current = true;

    if (result.ok) {
      const added = result.trainer;
      pending.current = null;
      // FR-009: the confirmed trainer appears exactly once.
      setList((l) =>
        l.status === 'ready' && !l.trainers.some((t) => t.id === added.id)
          ? { status: 'ready', trainers: [...l.trainers, added] }
          : l,
      );
      setName('');
      setSpeciality('');
      setSave('success');
    } else {
      pending.current = attempt;
      setSave('error');
    }
    deps.current.analytics(addResultEvent(submissionType, result));
  }

  const fieldDescribedBy = (field: 'name' | 'speciality') =>
    [field === 'name' ? id('name-help') : '', errors[field] ? id(`${field}-error`) : ''].filter(Boolean).join(' ') || undefined;

  const submitText = save === 'saving' ? COPY.adding : save === 'error' ? COPY.retrySave : COPY.submit;

  return (
    <main className="trainers-page">
      <header className="trainers-page__header">
        <h1 className="trainers-page__title">{COPY.heading}</h1>
        <p className="trainers-page__muted">{COPY.intro}</p>
      </header>

      <div className="trainers-page__layout">
        <section className="trainers-card trainers-form-card" aria-labelledby={id('form-heading')}>
          <h2 id={id('form-heading')} className="trainers-card__heading">{COPY.formHeading}</h2>
          <p className="trainers-page__muted">{COPY.required}</p>

          <form className="trainers-form" noValidate onSubmit={onSubmit} aria-busy={save === 'saving'}>
            <div className="trainers-field">
              <label htmlFor={id('name')}>{COPY.nameLabel}</label>
              <input
                ref={nameRef}
                id={id('name')}
                name="name"
                type="text"
                autoComplete="off"
                required
                aria-required="true"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={fieldDescribedBy('name')}
                disabled={formDisabled}
                value={name}
                onChange={(e) => onEdit(setName)(e.target.value)}
              />
              <p id={id('name-help')} className="trainers-field__helper">{COPY.nameHelper}</p>
              {errors.name && (
                <p id={id('name-error')} className="trainers-field__error">{fieldErrorText('name', errors.name)}</p>
              )}
            </div>

            <div className="trainers-field">
              <label htmlFor={id('speciality')}>{COPY.specialityLabel}</label>
              {/* OQ-001 undecided: provisional free-text input, as in the prototype. */}
              <input
                ref={specialityRef}
                id={id('speciality')}
                name="speciality"
                type={SPECIALITY_CONTROL}
                autoComplete="off"
                required
                aria-required="true"
                aria-invalid={errors.speciality ? true : undefined}
                aria-describedby={fieldDescribedBy('speciality')}
                disabled={formDisabled}
                value={speciality}
                onChange={(e) => onEdit(setSpeciality)(e.target.value)}
              />
              {errors.speciality && (
                <p id={id('speciality-error')} className="trainers-field__error">
                  {fieldErrorText('speciality', errors.speciality)}
                </p>
              )}
            </div>

            {/* Save status sits inside the form, above its action (prototype). Live regions stay
                in the page (never display:none) so their changes are announced. */}
            <div className="trainers-form__statuses">
              <div role="status" className="trainers-form__status trainers-form__status--success">
                {save === 'success' && COPY.added}
                {save === 'saving' && <span className="visually-hidden">{COPY.adding}</span>}
              </div>
              <div role="alert" className="trainers-form__status trainers-form__status--error">
                {save === 'error' && COPY.saveError}
              </div>
            </div>

            <button ref={submitRef} type="submit" className="trainers-button" disabled={formDisabled}>
              {submitText}
            </button>
          </form>
        </section>

        <section className="trainers-card trainers-list-card" aria-labelledby={id('list-heading')}>
          <h2 id={id('list-heading')} className="trainers-card__heading">{COPY.listHeading}</h2>
          {/* Explicit roles keep table semantics when narrow screens restyle rows as blocks. */}
          <table role="table" className="trainers-table" aria-labelledby={id('list-heading')} aria-busy={list.status === 'loading'}>
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">{COPY.colName}</th>
                <th role="columnheader" scope="col">{COPY.colSpeciality}</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {/* OQ-003 undecided: server order, no sort applied or promised. */}
              {list.status === 'ready' &&
                list.trainers.map((t) => (
                  <tr key={t.id} role="row">
                    <td role="cell" data-label={COPY.colName}>{t.name}</td>
                    <td role="cell" data-label={COPY.colSpeciality}>{t.speciality}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div role="status" className="trainers-list__status">
            {list.status === 'loading' && <p className="trainers-page__muted">{COPY.loading}</p>}
            {list.status === 'ready' && list.trainers.length === 0 && (
              <>
                <p className="trainers-list__empty">{COPY.empty}</p>
                <p className="trainers-page__muted">{COPY.emptyHint}</p>
              </>
            )}
          </div>
          <div role="alert" className="trainers-list__status">
            {list.status === 'error' && <p className="trainers-list__error">{COPY.loadError}</p>}
          </div>
          {list.status === 'error' && (
            <button type="button" className="trainers-button trainers-button--secondary" onClick={() => load('retry')}>
              {COPY.retryLoad}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
