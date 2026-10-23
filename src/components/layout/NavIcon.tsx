import { BookOpen, CalendarDays, Calculator, Home, ScrollText } from "lucide-react";
import type { NavItem } from "./nav-items";

export function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  const props = { className, "aria-hidden": true as const };
  switch (icon) {
    case "home":
      return <Home {...props} />;
    case "events":
      return <CalendarDays {...props} />;
    case "rules":
      return <ScrollText {...props} />;
    case "guides":
      return <BookOpen {...props} />;
    case "tools":
      return <Calculator {...props} />;
  }
}
