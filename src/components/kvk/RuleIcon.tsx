import { Ban, CircleCheck, Info } from "lucide-react";
import type { KvkRuleKind } from "@/lib/data/types";

/** Do / don't / info marker of a battle-day instruction (battle plan and leader page). */
export function RuleIcon({ kind }: { kind: KvkRuleKind }) {
  const common = "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl";
  switch (kind) {
    case "do":
      return (
        <span className={`${common} bg-success-soft text-success`} aria-hidden>
          <CircleCheck className="size-5" />
        </span>
      );
    case "dont":
      return (
        <span className={`${common} bg-danger-soft text-danger`} aria-hidden>
          <Ban className="size-5" />
        </span>
      );
    default:
      return (
        <span className={`${common} bg-primary-soft text-primary`} aria-hidden>
          <Info className="size-5" />
        </span>
      );
  }
}
