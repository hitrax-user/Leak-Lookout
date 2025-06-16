import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function AppLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
      <ShieldCheck className="h-8 w-8" />
      <span className="text-xl font-headline font-semibold">Leak Lookout</span>
    </Link>
  );
}
