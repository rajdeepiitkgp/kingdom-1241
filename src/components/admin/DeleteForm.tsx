"use client";

/** A one-button form that asks for confirmation before running a delete action. */
export function DeleteForm({
  action,
  hidden,
  confirmText,
  label = "Delete",
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="btn-ghost btn-sm text-danger">
        {label}
      </button>
    </form>
  );
}
