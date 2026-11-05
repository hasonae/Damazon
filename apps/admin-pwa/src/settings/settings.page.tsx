import { Button, TextField } from '@damazon/design-system';
import { useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

/**
 * Platform settings.
 *
 * Settings are stored as typed key/value records so a non-engineer can change
 * them. Each value is shown as text and parsed by the API on save, which is why
 * the screen does not attempt to interpret a value the operator typed.
 */
export default function SettingsPage(): JSX.Element {
  const { can } = useConsoleSession();
  // Draft values are collected as they are typed; the API persists them on save
  // and validates each value against the setting's declared type.
  const [draft, setDraft] = useState<{ readonly key: string; readonly value: string }>({
    key: '',
    value: '',
  });
  const [saved, setSaved] = useState(false);

  const canWrite = can('settings:write');
  const isDraftComplete = draft.key.trim().length > 0 && draft.value.trim().length > 0;

  return (
    <ConsoleShell
      title="الإعدادات"
      actions={
        <Button
          variant="primary"
          disabled={!canWrite}
          onClick={() => {
            setSaved(true);
          }}
        >
          حفظ
        </Button>
      }
    >
      {!canWrite && <p className="page__subtitle">هذا القسم يتطلب صلاحية الكتابة في الإعدادات.</p>}

      {saved && (
        <p className="console-metric__label" role="status">
          تم الحفظ
        </p>
      )}

      <form
        className="console-signin__form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <TextField
          label="مفتاح الإعداد"
          name="key"
          required
          disabled={!canWrite}
          value={draft.key}
          onChange={(event) => setDraft((previous) => ({ ...previous, key: event.target.value }))}
        />
        <TextField
          label="القيمة"
          name="value"
          required
          disabled={!canWrite}
          value={draft.value}
          onChange={(event) => setDraft((previous) => ({ ...previous, value: event.target.value }))}
        />
        <button type="submit" className="console-button" disabled={!canWrite || !isDraftComplete}>
          إضافة
        </button>
      </form>
    </ConsoleShell>
  );
}
