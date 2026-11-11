import {
  Car,
  CookingPot,
  Flower2,
  Hammer,
  Sparkles,
  Tent,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/convex/lib/constants";

const icons: Record<Category, LucideIcon> = {
  power_tools: Hammer,
  garden: Flower2,
  kitchen: CookingPot,
  camping: Tent,
  automotive: Car,
  cleaning: Sparkles,
  other: Wrench,
};

export function CategoryIcon({ category }: { category: Category }) {
  const Icon = icons[category];
  return <Icon aria-hidden className="size-4 text-primary" />;
}
