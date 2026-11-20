/**
 * NFR-008 analytics events for the Trainers page. Payloads carry only the enumerated PRD
 * properties: never trainer names, specialities, identifiers, attempt keys, personal data,
 * codes, tokens or free-text errors (NFR-002).
 *
 * The app has no analytics mechanism yet (adding one would need new software), so the default
 * sink sends nothing. Callers may pass a sink.
 */
export type LoadType = 'initial' | 'retry';
export type SubmissionType = 'initial' | 'retry';

export type TrainersEvent =
  | {
      name: 'trainers_load_result';
      properties: { result: 'success' | 'error'; load_type: LoadType; list_state: 'empty' | 'populated' | 'unavailable' };
    }
  | {
      name: 'trainer_add_validation_failed';
      properties: { field: 'name' | 'speciality' | 'both'; reason: 'required' | 'name_too_long' | 'multiple' };
    }
  | { name: 'trainer_add_submitted'; properties: { submission_type: SubmissionType } }
  | {
      name: 'trainer_add_result';
      properties: {
        result: 'success' | 'failure' | 'unconfirmed';
        submission_type: SubmissionType;
        error_category: 'none' | 'connectivity' | 'permission' | 'service';
      };
    };

export type TrainersAnalyticsSink = (event: TrainersEvent) => void;

export const noopTrainersAnalytics: TrainersAnalyticsSink = () => {};

export function loadResultEvent(loadType: LoadType, count: number | null): TrainersEvent {
  return {
    name: 'trainers_load_result',
    properties: {
      result: count === null ? 'error' : 'success',
      load_type: loadType,
      list_state: count === null ? 'unavailable' : count > 0 ? 'populated' : 'empty',
    },
  };
}

export function validationFailedEvent(errors: { name?: 'required' | 'too_long'; speciality?: 'required' | 'too_long' }): TrainersEvent {
  const field = errors.name && errors.speciality ? 'both' : errors.name ? 'name' : 'speciality';
  const reasons = new Set([errors.name, errors.speciality].filter(Boolean));
  const reason = reasons.size > 1 ? 'multiple' : reasons.has('too_long') ? 'name_too_long' : 'required';
  return { name: 'trainer_add_validation_failed', properties: { field, reason } };
}

export function submittedEvent(submissionType: SubmissionType): TrainersEvent {
  return { name: 'trainer_add_submitted', properties: { submission_type: submissionType } };
}

export function addResultEvent(
  submissionType: SubmissionType,
  outcome: { ok: true } | { ok: false; result: 'failure' | 'unconfirmed'; category: 'connectivity' | 'permission' | 'service' },
): TrainersEvent {
  return {
    name: 'trainer_add_result',
    properties: {
      result: outcome.ok ? 'success' : outcome.result,
      submission_type: submissionType,
      error_category: outcome.ok ? 'none' : outcome.category,
    },
  };
}
