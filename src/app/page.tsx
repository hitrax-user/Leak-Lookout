import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
  return null; // Or a loading component if redirect takes time
}
