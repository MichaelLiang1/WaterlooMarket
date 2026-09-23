"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionState } from "@/lib/action-state";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

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
  const [clientError, setClientError] = useState("");
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
          // Over the server's body limit the action never runs and the page
          // crashes, so catch it here with a message the user can act on.
          const uploadBytes = [...formData.values()].reduce(
            (sum, v) => sum + (v instanceof File ? v.size : 0),
            0,
          );
          if (uploadBytes > MAX_UPLOAD_BYTES) {
            const mb = (n: number) => Math.round(n / (1024 * 1024));
            setClientError(
              `Your photos add up to ${mb(uploadBytes)} MB, over the ${mb(MAX_UPLOAD_BYTES)} MB limit. Remove a few photos and try again.`,
            );
            return;
          }
          setClientError("");
          startTransition(() => formAction(formData));
        }}
      >
        {children}
        {(clientError || state?.error) && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {clientError || state?.error}
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
