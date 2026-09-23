"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<{ state: ActionState; pending: boolean }>({
  state: undefined,
  pending: false,
});

/**
 * A <form> bound to a server action via useActionState. Shows the action's
 * error/success message and makes field errors available to <FieldError>.
 *
 * Submits via startTransition rather than the form `action` so React doesn't
 * reset the fields when validation fails. The `action` attribute stays for
 * progressive enhancement before hydration.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  /** Ask the user to confirm before submitting (for destructive actions). */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormStateContext.Provider value={{ state, pending }}>
      <form
        ref={ref}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          if (confirm && !window.confirm(confirm)) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter;
          const formData = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(formData));
        }}
      >
        {children}
        {state?.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {showSuccess && state?.success && (
          <p role="status" className="mt-2 text-sm text-green-700">
            {state.success}
          </p>
        )}
      </form>
    </FormStateContext.Provider>
  );
}

export function useFieldError(name: string) {
  return useContext(FormStateContext).state?.fieldErrors?.[name];
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return <p className="mt-1 text-xs text-red-700">{error}</p>;
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useContext(FormStateContext);
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Label + control + field error. `children` is the input element. */
export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}
