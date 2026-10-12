import { useEffect, useRef, useState } from "react";
import { useNavigation, useSubmit } from "react-router";
import type { BorrowerFieldErrors, BorrowerRawInput } from "~/matching/borrower-input";
import { formatCents, parseDollarsToCents } from "~/shared/money";

const DEBOUNCE_MS = 250;

const TIER_OPTIONS = [
  { value: "", label: "Not sure" },
  { value: "Fair", label: "Fair" },
  { value: "Good", label: "Good" },
  { value: "Excellent", label: "Excellent" },
] as const;

/**
 * The borrower inputs, live as the rep types (D11). Each change resets a
 * ~250ms timer that submits the form with `useSubmit`, which programmatically
 * submits a GET form from code; `replace: true` stops the Back button from
 * stepping through every keystroke, and React Router cancels an older
 * in-flight request so a slow stale search can't overwrite a newer one
 * (FR-11).
 */
export function SearchForm({
  values,
  fieldErrors,
  businessTypes,
}: {
  values: BorrowerRawInput;
  fieldErrors: BorrowerFieldErrors;
  businessTypes: string[];
}) {
  const submit = useSubmit();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [amountText, setAmountText] = useState(values.amount);

  useEffect(() => setAmountText(values.amount), [values.amount]);

  function scheduleSubmit() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (formRef.current !== null) submit(formRef.current, { method: "get", replace: true });
    }, DEBOUNCE_MS);
  }

  const amountParsed = parseDollarsToCents(amountText);
  const updating = navigation.state !== "idle";
  const errorClass = "mt-1 text-sm text-red-700 dark:text-red-400";
  const fieldClass =
    "mt-1 block w-full rounded border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-900";

  return (
    <form ref={formRef} onChange={scheduleSubmit} className="space-y-4" aria-label="Borrower details">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium">
          Loan amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          aria-invalid={fieldErrors.amount !== undefined}
          aria-describedby={fieldErrors.amount !== undefined ? "amount-error" : "amount-echo"}
          className={fieldClass}
        />
        {amountParsed.ok ? (
          <p id="amount-echo" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            = {formatCents(amountParsed.value)}
          </p>
        ) : (
          <p id="amount-echo" className="sr-only" />
        )}
        {fieldErrors.amount !== undefined && (
          <p id="amount-error" role="alert" className={errorClass}>
            {fieldErrors.amount}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium">
          Business type
        </label>
        <select
          id="type"
          name="type"
          defaultValue={values.type}
          aria-invalid={fieldErrors.type !== undefined}
          aria-describedby={fieldErrors.type !== undefined ? "type-error" : undefined}
          className={fieldClass}
        >
          <option value="">Choose one</option>
          {businessTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {fieldErrors.type !== undefined && (
          <p id="type-error" role="alert" className={errorClass}>
            {fieldErrors.type}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Credit tier</legend>
        <div className="mt-1 flex gap-4">
          {TIER_OPTIONS.map(({ value, label }) => (
            <label key={value === "" ? "unknown" : value} className="flex items-center gap-1 text-sm">
              <input type="radio" name="tier" value={value} defaultChecked={values.tier === value} />
              {label}
            </label>
          ))}
        </div>
        {fieldErrors.tier !== undefined && (
          <p role="alert" className={errorClass}>
            {fieldErrors.tier}
          </p>
        )}
      </fieldset>

      <div className="flex gap-4">
        <div>
          <label htmlFor="years" className="block text-sm font-medium">
            Full years in business
          </label>
          <input
            id="years"
            name="years"
            type="number"
            min={0}
            max={99}
            defaultValue={values.years}
            aria-invalid={fieldErrors.years !== undefined}
            aria-describedby={fieldErrors.years !== undefined ? "years-error" : "years-hint"}
            className="mt-1 block w-24 rounded border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-900"
          />
          <p id="years-hint" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Under 1 year = 0
          </p>
          {fieldErrors.years !== undefined && (
            <p id="years-error" role="alert" className={errorClass}>
              {fieldErrors.years}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="score" className="block text-sm font-medium">
            Credit score (optional)
          </label>
          <input
            id="score"
            name="score"
            type="number"
            min={300}
            max={850}
            defaultValue={values.score}
            aria-invalid={fieldErrors.score !== undefined}
            aria-describedby={fieldErrors.score !== undefined ? "score-error" : undefined}
            className="mt-1 block w-24 rounded border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-900"
          />
          {fieldErrors.score !== undefined && (
            <p id="score-error" role="alert" className={errorClass}>
              {fieldErrors.score}
            </p>
          )}
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">
        {updating ? "Updating…" : ""}
      </p>
    </form>
  );
}
