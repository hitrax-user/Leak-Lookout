import {
  KeyRound,
  Github,
  FileText,
  Gitlab,
  GitBranch, // For Bitbucket as generic git icon
  Cloud, // For AWS/Google
  CreditCard, // For Stripe
  Briefcase, // Generic for 'other' source
  Database,
  Server,
  Globe,
  ShieldQuestion,
} from "lucide-react";
import type { ApiKeySource } from "@/lib/types";

interface ApiKeyIconProps {
  type: string | ApiKeySource;
  isSourceType?: boolean;
  className?: string;
}

const SourceTypeIconMap: Record<ApiKeySource, React.ElementType> = {
  github: Github,
  pastebin: FileText,
  gitlab: Gitlab,
  bitbucket: GitBranch,
  dark_web_forum: ShieldQuestion, // Placeholder
  other: Briefcase,
};

// Simplified KeyType to Icon mapping
const getKeyTypeIcon = (keyType: string): React.ElementType => {
  const lowerKeyType = keyType.toLowerCase();
  if (lowerKeyType.includes("aws")) return Cloud;
  if (lowerKeyType.includes("google") || lowerKeyType.includes("firebase")) return Globe;
  if (lowerKeyType.includes("stripe")) return CreditCard;
  if (lowerKeyType.includes("database") || lowerKeyType.includes("sql")) return Database;
  if (lowerKeyType.includes("server") || lowerKeyType.includes("ssh")) return Server;
  return KeyRound; // Default
};

export default function ApiKeyIcon({ type, isSourceType = false, className = "h-5 w-5" }: ApiKeyIconProps) {
  const IconComponent = isSourceType
    ? SourceTypeIconMap[type as ApiKeySource] || Briefcase
    : getKeyTypeIcon(type);

  return <IconComponent className={className} aria-label={`${isSourceType ? 'Source: ' : 'Key Type: '}${type}`} />;
}
