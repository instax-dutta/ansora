"use client";

import { RANGE_PRESETS } from "@/lib/analytics/query";

export interface DateRange {
  /** Preset in days, or null for a custom window. */
  days: number | null;
  from: string;
  to: string;
}

/**
 * Presets plus an explicit custom window.
 *
 * The custom inputs exist because "last 30 days" is the wrong question after a
 * launch or an outage. The timezone is stated next to the control rather than
 * buried in a settings page: every number on this screen is bucketed in it.
 */
export function DateRangePicker({
  value,
  timezone,
  disabled,
  onChange,
}: {
  value: DateRange;
  timezone: string;
  disabled?: boolean;
  onChange: (next: DateRange) => void;
}) {
  const isPreset = (days: number) => value.days === days;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">Period</span>
        <div role="group" aria-label="Reporting period" className="flex overflow-hidden rounded-lg border border-line">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={isPreset(preset.days)}
              onClick={() => onChange({ ...value, days: preset.days })}
              className={`px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                isPreset(preset.days)
                  ? "bg-brand text-on-brand"
                  : "bg-surface text-ink-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div>
          <label htmlFor="analytics-from" className="mb-1.5 block text-xs font-medium text-ink-muted">
            From
          </label>
          <input
            id="analytics-from"
            type="date"
            value={value.from}
            max={value.to}
            disabled={disabled}
            onChange={(event) => onChange({ days: null, from: event.target.value, to: value.to })}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
        <div>
          <label htmlFor="analytics-to" className="mb-1.5 block text-xs font-medium text-ink-muted">
            To
          </label>
          <input
            id="analytics-to"
            type="date"
            value={value.to}
            min={value.from}
            disabled={disabled}
            onChange={(event) => onChange({ days: null, from: value.from, to: event.target.value })}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Dates are calendar days in {timezone} and the range includes both ends.
      </p>
    </div>
  );
}
