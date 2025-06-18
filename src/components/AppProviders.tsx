
"use client";

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { SidebarProvider } from '@/components/ui/sidebar';
import { app as firebaseApp } from '@/lib/firebase'; // Import to ensure Firebase initializes

export default function AppProviders({ children }: { children: React.ReactNode }) {
  // By importing firebaseApp, we ensure Firebase initializes when providers are mounted.
  // Actual usage of db, auth, etc., will be in specific hooks or components.
  if (!firebaseApp) {
    console.error("Firebase app not initialized!");
  }
  
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider defaultOpen={true}>
        {children}
      </SidebarProvider>
    </ThemeProvider>
  );
}
