'use client';

import type { ChangeEventHandler } from 'react';
import type { InstrumentOption } from '@wtc/shared';

function datalistIdFor(name: string): string {
  return `${name.replace(/[^a-zA-Z0-9_-]/g, '-')}-catalog`;
}

export function InstrumentPicker({
  name,
  label = 'Coin',
  value,
  defaultValue,
  options,
  placeholder,
  help,
  invalid,
  describedBy,
  onChange,
}: {
  name: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  options: readonly InstrumentOption[];
  placeholder: string;
  help: string;
  invalid?: boolean;
  describedBy?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  const datalistId = datalistIdFor(name);
  const inputValueProps = value === undefined ? { defaultValue } : { value };

  return (
    <label className="wtc-stack" style={{ gap: 4 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <input
        className="wtc-input"
        list={datalistId}
        name={name}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange}
        {...inputValueProps}
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={option.symbol} value={option.symbol} label={`${option.venue} - ${option.format}${option.source === 'runtime' ? ' - runtime' : ''}`} />
        ))}
      </datalist>
      <span className="wtc-dim" style={{ fontSize: 11 }}>{help}</span>
    </label>
  );
}
