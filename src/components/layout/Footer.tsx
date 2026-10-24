import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { AdminEntry } from "./AdminEntry";

export function Footer({
  dict,
  discordUrl,
  joinLabel,
  createdBy,
  adminHref,
}: {
  dict: Dictionary;
  discordUrl: string | null;
  joinLabel: string;
  createdBy: string | null;
  /** Link to the council's admin area (login required). */
  adminHref: string;
}) {
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-8 text-center text-sm text-ink-muted">
      <div className="card-soft px-6 py-5">
        <p className="font-semibold">{dict["footer.disclaimer"]}</p>
        <p className="mt-2">{dict["footer.translationNote"]}</p>
        {createdBy && (
          <p className="mt-3 text-xs font-bold text-ink-faint">
            {format(dict["footer.createdBy"], { name: createdBy })}
          </p>
        )}
        {discordUrl && (
          <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm mt-4">
            {joinLabel}
          </a>
        )}
        <AdminEntry
          variant="footer"
          href={adminHref}
          labels={{ signIn: dict["admin.signInLink"], note: dict["admin.signInNote"], panel: dict["admin.panelLink"] }}
        />
      </div>
    </footer>
  );
}
