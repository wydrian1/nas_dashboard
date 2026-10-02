"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormAction } from "@/lib/personal-types";

export function ActionForm({ action, children, className }: { action: FormAction; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className={className}>
    {children}
    {state.error && <p className="error form-feedback" role="alert">{state.error}</p>}
    {state.success && <p className="form-success form-feedback" role="status">{state.success}</p>}
  </form>;
}
export function ActionButton({ children, className = "secondary-button", label }: { children: React.ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-label={label} aria-busy={pending}>{pending ? "…" : children}</button>;
}
