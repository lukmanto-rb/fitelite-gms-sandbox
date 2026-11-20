import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TrainersPage from './TrainersPage';
import { COPY, type Trainer, type TrainersApi } from './trainers';
import type { TrainersEvent } from './analytics';
import { controlledApi, fakeServer } from './testApi';

const ALEX: Trainer = { id: '1', name: 'Alex Morgan', speciality: 'Strength training' };

const nameInput = () => screen.getByLabelText('Name') as HTMLInputElement;
const specialityInput = () => screen.getByLabelText('Speciality') as HTMLInputElement;
const table = () => screen.getByRole('table', { name: 'All trainers' });
const rows = () => within(table()).getAllByRole('row').slice(1); // skip header row
const rowTexts = () => rows().map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));

function addButton(): HTMLButtonElement {
  // The form's submit button (the list "Try again" is a separate, type=button control).
  return document.querySelector('form button[type="submit"]') as HTMLButtonElement;
}

function fill(name: string, speciality: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.change(specialityInput(), { target: { value: speciality } });
}

async function renderReady(api: TrainersApi, analytics?: (e: TrainersEvent) => void) {
  const utils = render(<TrainersPage api={api} analytics={analytics} />);
  await waitFor(() => expect(screen.queryByText(COPY.loading)).toBeNull());
  return utils;
}


describe('Trainers page (FIT-941 T2)', () => {
  describe('AC-001 copy', () => {
    it('shows heading, supporting sentence, form labels, required text, helper and add action', async () => {
      await renderReady(fakeServer().api);
      expect(screen.getByRole('heading', { level: 1, name: 'Trainers' })).toBeInTheDocument();
      expect(screen.getByText('Add trainers and view all trainers.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Add trainer' })).toBeInTheDocument();
      expect(screen.getByText('Both fields are required.')).toBeInTheDocument();
      expect(nameInput()).toBeRequired();
      expect(specialityInput()).toBeRequired();
      expect(nameInput()).toHaveAccessibleDescription('Maximum 100 characters.');
      expect(addButton()).toHaveTextContent('Add trainer');
      expect(addButton()).toBeEnabled();
      expect(screen.getByRole('heading', { level: 2, name: 'All trainers' })).toBeInTheDocument();
      expect(within(table()).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(within(table()).getByRole('columnheader', { name: 'Speciality' })).toBeInTheDocument();
    });

    it('OQ-001 interim: speciality is a free-text input, not a fixed list', async () => {
      await renderReady(fakeServer().api);
      expect(specialityInput().tagName).toBe('INPUT');
      expect(specialityInput()).toHaveAttribute('type', 'text');
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('Trainers / List (AC-002)', () => {
    it('shows every saved record under Name and Speciality, in server order, with no edit or delete actions', async () => {
      const zed: Trainer = { id: '2', name: 'Zoë Ålund', speciality: 'Yoga' };
      const bea: Trainer = { id: '3', name: 'bea', speciality: 'Spin' };
      await renderReady(fakeServer([zed, ALEX, bea]).api);
      // OQ-003 interim: the order the server returns, no client sort.
      expect(rowTexts()).toEqual([
        ['Zoë Ålund', 'Yoga'],
        ['Alex Morgan', 'Strength training'],
        ['bea', 'Spin'],
      ]);
      expect(within(table()).queryByRole('button')).toBeNull();
      expect(screen.queryByRole('button', { name: /edit|delete/i })).toBeNull();
      expect(screen.queryByText(COPY.empty)).toBeNull();
    });
  });

  describe('Trainers / Empty (AC-003)', () => {
    it('shows the empty copy only after a successful empty retrieval, with the form enabled', async () => {
      await renderReady(fakeServer().api);
      expect(screen.getByText('No trainers yet')).toBeInTheDocument();
      expect(screen.getByText('Add your first trainer using the form.')).toBeInTheDocument();
      expect(rows()).toHaveLength(0);
      expect(nameInput()).toBeEnabled();
      expect(specialityInput()).toBeEnabled();
      expect(addButton()).toBeEnabled();
    });
  });

  describe('Trainers / Loading (AC-004)', () => {
    it('shows "Loading trainers…" announced, no empty message, form visible but disabled', () => {
      const { api } = controlledApi();
      render(<TrainersPage api={api} />);
      const status = screen.getByText('Loading trainers…');
      expect(status.closest('[role="status"]')).not.toBeNull();
      expect(screen.queryByText(COPY.empty)).toBeNull();
      expect(screen.queryByText(COPY.emptyHint)).toBeNull();
      expect(nameInput()).toBeDisabled();
      expect(specialityInput()).toBeDisabled();
      expect(addButton()).toBeDisabled();
      expect(addButton()).toHaveTextContent('Add trainer');
      expect(api.list).toHaveBeenCalledTimes(1);
    });

    it('starts exactly one retrieval under StrictMode', async () => {
      const { api, lists } = controlledApi();
      render(
        <StrictMode>
          <TrainersPage api={api} />
        </StrictMode>,
      );
      expect(api.list).toHaveBeenCalledTimes(1);
      await act(async () => lists[0]!.resolve([ALEX]));
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]);
    });
  });

  describe('Trainers / Load Error (AC-005, AC-006, AC-007)', () => {
    it('AC-005: shows the load error and list retry, never the empty message; form stays disabled', async () => {
      const { api, lists } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.reject(new Error('x')));
      const error = screen.getByText("Couldn't load trainers. Try again.");
      expect(error.closest('[role="alert"]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Try again' })).toHaveAttribute('type', 'button');
      expect(screen.queryByText(COPY.empty)).toBeNull();
      expect(rows()).toHaveLength(0);
      expect(nameInput()).toBeDisabled();
      expect(addButton()).toBeDisabled();
    });

    it('AC-006: repeated retry clicks start one retrieval, show Loading, then List or Empty', async () => {
      const { api, lists } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.reject(new Error('x')));
      const retry = screen.getByRole('button', { name: 'Try again' });
      fireEvent.click(retry);
      fireEvent.click(retry);
      fireEvent.click(retry);
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Loading trainers…')).toBeInTheDocument();
      expect(screen.queryByText(COPY.loadError)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      await act(async () => lists[1]!.resolve([ALEX]));
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]);
      expect(nameInput()).toBeEnabled();
    });

    it('AC-006: a successful empty retry shows Trainers / Empty', async () => {
      const { api, lists } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.reject(new Error('x')));
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => lists[1]!.resolve([]));
      expect(screen.getByText(COPY.empty)).toBeInTheDocument();
    });

    it('AC-007: a failed retry returns to Load Error with retry available and no empty message', async () => {
      const { api, lists } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.reject(new Error('x')));
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => lists[1]!.reject(new Error('x')));
      expect(screen.getByText(COPY.loadError)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
      expect(screen.queryByText(COPY.empty)).toBeNull();
    });
  });

  describe('Trainers / Validation Error (AC-008, AC-009, AC-010)', () => {
    it('AC-008: both empty shows both messages beside the fields, focuses Name, creates nothing', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fireEvent.click(addButton());
      expect(screen.getByText('Enter a name.')).toBeInTheDocument();
      expect(screen.getByText('Enter a speciality.')).toBeInTheDocument();
      expect(nameInput()).toHaveAccessibleDescription('Maximum 100 characters. Enter a name.');
      expect(specialityInput()).toHaveAccessibleDescription('Enter a speciality.');
      expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
      expect(specialityInput()).toHaveAttribute('aria-invalid', 'true');
      expect(nameInput()).toHaveFocus();
      expect(server.api.add).not.toHaveBeenCalled();
      expect(screen.getByText(COPY.empty)).toBeInTheDocument();
    });

    it('AC-008: whitespace-only speciality is rejected, values kept, Speciality focused', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fill('Sofia García', '   ');
      fireEvent.submit(addButton().form!);
      expect(screen.queryByText('Enter a name.')).toBeNull();
      expect(screen.getByText('Enter a speciality.')).toBeInTheDocument();
      expect(nameInput()).toHaveValue('Sofia García');
      expect(specialityInput()).toHaveValue('   ');
      expect(specialityInput()).toHaveFocus();
      expect(server.api.add).not.toHaveBeenCalled();
    });

    it('AC-008: whitespace-only name is rejected', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fill('  \t ', 'Pilates');
      fireEvent.click(addButton());
      expect(screen.getByText('Enter a name.')).toBeInTheDocument();
      expect(nameInput()).toHaveFocus();
      expect(specialityInput()).toHaveValue('Pilates');
      expect(server.api.add).not.toHaveBeenCalled();
    });

    it('AC-009: a name over 100 characters after trimming is rejected with the length message', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      const long = `  ${'a'.repeat(101)}  `;
      fill(long, 'Pilates');
      fireEvent.click(addButton());
      expect(screen.getByText('Use 100 characters or fewer.')).toBeInTheDocument();
      expect(screen.queryByText('Enter a name.')).toBeNull();
      expect(nameInput()).toHaveValue(long);
      expect(specialityInput()).toHaveValue('Pilates');
      expect(nameInput()).toHaveFocus();
      expect(server.api.add).not.toHaveBeenCalled();
    });

    it('AC-010: an exactly 100-character international name with punctuation is accepted and shown trimmed, case kept', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      const name = `Zoë O'Brien-Łukasz ${'é'.repeat(100 - "Zoë O'Brien-Łukasz ".length)}`;
      expect(Array.from(name)).toHaveLength(100);
      fill(`   ${name}  `, '  Pilates & Barre ');
      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');
      expect(server.api.add).toHaveBeenCalledWith({ name, speciality: 'Pilates & Barre' }, expect.any(String));
      expect(rowTexts()).toEqual([[name, 'Pilates & Barre']]);
    });

    it('corrected values submit normally and clear the field errors', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fireEvent.click(addButton());
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');
      expect(screen.queryByText('Enter a name.')).toBeNull();
      expect(nameInput()).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('Trainers / Adding (AC-011, AC-012)', () => {
    it('AC-011: shows "Adding…", disables controls, keeps values and list, no unconfirmed row', async () => {
      const { api, lists } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([ALEX]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      expect(addButton()).toHaveTextContent('Adding…');
      expect(addButton()).toBeDisabled();
      expect(nameInput()).toBeDisabled();
      expect(specialityInput()).toBeDisabled();
      expect(nameInput()).toHaveValue('Sofia García');
      expect(specialityInput()).toHaveValue('Pilates');
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]);
      expect(screen.queryByText('Sofia García', { selector: 'td' })).toBeNull();
      // Announced to assistive technology.
      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Adding…')).toBe(true);
    });

    it('AC-012: repeated clicks and Enter while saving send one request and save one record', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([]));
      fill('Sofia García', 'Pilates');
      const button = addButton();
      const form = button.form!;
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.submit(form);
      fireEvent.keyDown(nameInput(), { key: 'Enter' });
      fireEvent.submit(form);
      expect(api.add).toHaveBeenCalledTimes(1);
      await act(async () => adds[0]!.resolve({ ok: true, trainer: { id: '9', name: 'Sofia García', speciality: 'Pilates' } }));
      expect(rowTexts()).toEqual([['Sofia García', 'Pilates']]);
    });

    it('AC-012 end to end: rapid double submit against the fake server creates exactly one record', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fill('Sofia García', 'Pilates');
      const form = addButton().form!;
      fireEvent.submit(form);
      fireEvent.submit(form);
      await screen.findByText('Trainer added.');
      expect(server.records).toHaveLength(1);
    });
  });

  describe('Trainers / Success (AC-013)', () => {
    it('shows the new row once, clears both fields, announces "Trainer added." which clears on edit', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([ALEX]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.resolve({ ok: true, trainer: { id: '2', name: 'Sofia García', speciality: 'Pilates' } }));
      expect(rowTexts()).toEqual([
        ['Alex Morgan', 'Strength training'],
        ['Sofia García', 'Pilates'],
      ]);
      expect(nameInput()).toHaveValue('');
      expect(specialityInput()).toHaveValue('');
      const added = screen.getByText('Trainer added.');
      expect(added.closest('[role="status"]')).not.toBeNull();
      expect(addButton()).toHaveTextContent('Add trainer');
      expect(addButton()).toBeEnabled();
      expect(api.list).toHaveBeenCalledTimes(1); // no refresh needed

      fireEvent.change(nameInput(), { target: { value: 'J' } });
      expect(screen.queryByText('Trainer added.')).toBeNull();
    });

    it('does not duplicate a row the list already has', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([ALEX]));
      fill('Alex Morgan', 'Strength training');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.resolve({ ok: true, trainer: ALEX }));
      expect(rows()).toHaveLength(1);
    });

    it('OQ-004 interim: a separate intentional add with the same values is not blocked and shows no matching-name message', async () => {
      const server = fakeServer([ALEX]);
      await renderReady(server.api);
      fill('Alex Morgan', 'Strength training');
      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');
      expect(server.records).toHaveLength(2);
      expect(screen.queryByText(/already exists/)).toBeNull();
    });
  });

  describe('Trainers / Save Error (AC-014, AC-015, AC-016)', () => {
    it('AC-014: keeps values and list, shows the save error and "Try again"', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([ALEX]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.resolve({ ok: false, result: 'unconfirmed', category: 'connectivity' }));
      const msg = screen.getByText("Couldn't confirm the trainer was added. Your entries are kept.");
      expect(msg.closest('[role="alert"]')).not.toBeNull();
      expect(addButton()).toHaveTextContent('Try again');
      expect(addButton()).toBeEnabled();
      expect(nameInput()).toHaveValue('Sofia García');
      expect(specialityInput()).toHaveValue('Pilates');
      expect(nameInput()).toBeEnabled();
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]);
      // Form retry and list retry are separate: no list "Try again" button here.
      expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
    });

    it('AC-014: a thrown request is treated as unconfirmed, not a crash', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.reject(new TypeError('Failed to fetch')));
      expect(screen.getByText(COPY.saveError)).toBeInTheDocument();
    });

    it('AC-015: a failed retry passes through Adding and returns to Save Error with values and list kept; same attempt key', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([ALEX]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.resolve({ ok: false, result: 'unconfirmed', category: 'service' }));

      fireEvent.click(addButton());
      expect(addButton()).toHaveTextContent('Adding…');
      expect(addButton()).toBeDisabled();
      expect(screen.queryByText(COPY.saveError)).toBeNull();
      await act(async () => adds[1]!.resolve({ ok: false, result: 'unconfirmed', category: 'service' }));

      expect(screen.getByText(COPY.saveError)).toBeInTheDocument();
      expect(addButton()).toHaveTextContent('Try again');
      expect(nameInput()).toHaveValue('Sofia García');
      expect(specialityInput()).toHaveValue('Pilates');
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]);
      expect(adds[1]!.key).toBe(adds[0]!.key);
    });

    it('AC-016: after a lost confirmation, an unchanged retry succeeds and the server holds exactly one record', async () => {
      const server = fakeServer([ALEX]);
      await renderReady(server.api);
      server.behaviour.loseConfirmation = true;
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await screen.findByText(COPY.saveError);
      expect(server.records).toHaveLength(2); // saved on the server, confirmation lost
      expect(rowTexts()).toEqual([['Alex Morgan', 'Strength training']]); // not shown before confirmation

      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');
      expect(server.records.filter((r) => r.name === 'Sofia García')).toHaveLength(1);
      expect(rowTexts()).toEqual([
        ['Alex Morgan', 'Strength training'],
        ['Sofia García', 'Pilates'],
      ]);
      const keys = (server.api.add as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1]);
      expect(keys[0]).toBe(keys[1]);
    });

    it('editing values after a save error starts a new attempt with a new key', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([]));
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await act(async () => adds[0]!.resolve({ ok: false, result: 'failure', category: 'service' }));
      fill('Sofia García', 'Yoga');
      fireEvent.click(addButton());
      expect(adds[1]!.key).not.toBe(adds[0]!.key);
    });

    it('a new add after a success uses a new key', async () => {
      const server = fakeServer();
      await renderReady(server.api);
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await waitFor(() => expect(server.records).toHaveLength(2));
    });
  });

  describe('AC-019 keyboard and screen reader', () => {
    it('uses a native form, labelled inputs, a semantic table and persistent live regions', async () => {
      await renderReady(fakeServer([ALEX]).api);
      expect(addButton().tagName).toBe('BUTTON');
      expect(addButton()).toHaveAttribute('type', 'submit');
      expect(nameInput().form).toBe(addButton().form);
      expect(screen.getByRole('table', { name: 'All trainers' })).toBeInTheDocument();
      expect(within(table()).getAllByRole('columnheader')).toHaveLength(2);
      expect(within(rows()[0]!).getAllByRole('cell')).toHaveLength(2);
      // Status regions exist before any message, so changes are announced.
      expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2);
      // Nothing removed from the tab order.
      for (const el of [nameInput(), specialityInput(), addButton()]) expect(el).not.toHaveAttribute('tabindex', '-1');
    });

    it('returns keyboard focus to the form action after a save finishes', async () => {
      const { api, lists, adds } = controlledApi();
      render(<TrainersPage api={api} />);
      await act(async () => lists[0]!.resolve([]));
      fill('Sofia García', 'Pilates');
      addButton().focus();
      fireEvent.click(addButton());
      (document.activeElement as HTMLElement | null)?.blur(); // a disabled button loses focus in browsers
      await act(async () => adds[0]!.resolve({ ok: false, result: 'unconfirmed', category: 'connectivity' }));
      expect(addButton()).toHaveFocus();
    });
  });

  describe('AC-020 analytics', () => {
    const ALLOWED: Record<TrainersEvent['name'], Record<string, string[]>> = {
      trainers_load_result: {
        result: ['success', 'error'],
        load_type: ['initial', 'retry'],
        list_state: ['empty', 'populated', 'unavailable'],
      },
      trainer_add_validation_failed: { field: ['name', 'speciality', 'both'], reason: ['required', 'name_too_long', 'multiple'] },
      trainer_add_submitted: { submission_type: ['initial', 'retry'] },
      trainer_add_result: {
        result: ['success', 'failure', 'unconfirmed'],
        submission_type: ['initial', 'retry'],
        error_category: ['none', 'connectivity', 'permission', 'service'],
      },
    };

    it('emits only enumerated properties and no trainer values, ids or keys across a full journey', async () => {
      const events: TrainersEvent[] = [];
      const server = fakeServer([ALEX]);
      server.api.list = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom: Alex Morgan'))
        .mockImplementation(async () => server.records.map((r) => ({ ...r })));
      render(<TrainersPage api={server.api} analytics={(e) => events.push(e)} />);
      await screen.findByText(COPY.loadError);
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await screen.findByText('Alex Morgan');

      fill('', 'Pilates');
      fireEvent.click(addButton());
      fill('x'.repeat(101), '');
      fireEvent.click(addButton());

      server.behaviour.loseConfirmation = true;
      fill('Sofia García', 'Pilates');
      fireEvent.click(addButton());
      await screen.findByText(COPY.saveError);
      fireEvent.click(addButton());
      await screen.findByText('Trainer added.');

      expect(events).toEqual([
        { name: 'trainers_load_result', properties: { result: 'error', load_type: 'initial', list_state: 'unavailable' } },
        { name: 'trainers_load_result', properties: { result: 'success', load_type: 'retry', list_state: 'populated' } },
        { name: 'trainer_add_validation_failed', properties: { field: 'name', reason: 'required' } },
        { name: 'trainer_add_validation_failed', properties: { field: 'both', reason: 'multiple' } },
        { name: 'trainer_add_submitted', properties: { submission_type: 'initial' } },
        { name: 'trainer_add_result', properties: { result: 'unconfirmed', submission_type: 'initial', error_category: 'connectivity' } },
        { name: 'trainer_add_submitted', properties: { submission_type: 'retry' } },
        { name: 'trainer_add_result', properties: { result: 'success', submission_type: 'retry', error_category: 'none' } },
      ]);

      const keys = (server.api.add as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[1]));
      const serialized = JSON.stringify(events);
      for (const secret of ['Alex', 'Morgan', 'Sofia', 'García', 'Pilates', 'Strength', 'boom', ...keys]) {
        expect(serialized).not.toContain(secret);
      }
      for (const e of events) {
        const allowed = ALLOWED[e.name];
        expect(Object.keys(e.properties).sort()).toEqual(Object.keys(allowed).sort());
        for (const [k, v] of Object.entries(e.properties)) expect(allowed[k]).toContain(v);
      }
    });
  });
});
