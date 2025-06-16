import { Badge } from "@/components/ui/badge";
import type { LeakStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeakStatusBadgeProps {
  status: LeakStatus;
}

export default function LeakStatusBadge({ status }: LeakStatusBadgeProps) {
  const statusStyles: Record<LeakStatus, string> = {
    new: "bg-blue-500 hover:bg-blue-600 text-white",
    investigating: "bg-yellow-500 hover:bg-yellow-600 text-black",
    remediated: "bg-green-500 hover:bg-green-600 text-white",
    false_positive: "bg-gray-500 hover:bg-gray-600 text-white",
    enhancing_context: "bg-purple-500 hover:bg-purple-600 text-white animate-pulse",
    validating_key: "bg-indigo-500 hover:bg-indigo-600 text-white animate-pulse",
    error_enhancing_context: "bg-red-600 hover:bg-red-700 text-white",
    error_validating_key: "bg-pink-600 hover:bg-pink-700 text-white",
  };

  return (
    <Badge className={cn("capitalize", statusStyles[status])}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
