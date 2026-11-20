-- FIT-941: trainers, each tied to one gym or workspace (BR-001). Only name and speciality are
-- kept about the trainer (NFR-002). idempotency_key identifies one add attempt so repeated clicks
-- or an unchanged retry never create a second record (FR-008); it is unique per workspace only.
-- There is deliberately no uniqueness on (name, speciality): that policy is OQ-004, undecided.
CREATE TABLE trainers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL,
  name text NOT NULL,
  speciality text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainers_attempt_once UNIQUE (workspace_id, idempotency_key)
);
