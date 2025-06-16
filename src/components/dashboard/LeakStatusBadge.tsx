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
    validating: "bg-purple-500 hover:bg-purple-600 text-white animate-pulse",
    error_enhancing: "bg-red-500 hover:bg-red-600 text-white",
  };

  return (
    <Badge className={cn("capitalize", statusStyles[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
