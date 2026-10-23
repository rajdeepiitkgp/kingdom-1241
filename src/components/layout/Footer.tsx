import { format, type Dictionary } from "@/lib/i18n/dictionary";

export function Footer({
  dict,
  discordUrl,
  joinLabel,
  createdBy,
}: {
  dict: Dictionary;
  discordUrl: string | null;
  joinLabel: string;
  createdBy: string | null;
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
      </div>
    </footer>
  );
}
