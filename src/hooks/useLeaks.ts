"use client";

import { useState, useEffect, useCallback } from 'react';
import type { LeakedKey, LeakStatus } from '@/lib/types';
import { mockLeaks } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';
import { enhanceLeakContextAction } from '@/app/actions';

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakedKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setLeaks(mockLeaks.sort((a,b) => new Date(b.detectionTimestamp).getTime() - new Date(a.detectionTimestamp).getTime()));
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const updateLeakStatus = useCallback((id: string, status: LeakStatus) => {
    setLeaks(prevLeaks => 
      prevLeaks.map(leak => 
        leak.id === id ? { ...leak, status } : leak
      )
    );
    toast({
      title: "Status Updated",
      description: `Leak ${id} status changed to ${status}.`,
    });
  }, [toast]);

  const enhanceContext = useCallback(async (leakId: string) => {
    const leakToEnhance = leaks.find(l => l.id === leakId);
    if (!leakToEnhance) {
      toast({ variant: "destructive", title: "Error", description: "Leak not found." });
      return;
    }

    setLeaks(prev => prev.map(l => l.id === leakId ? { ...l, status: 'validating' } : l));

    try {
      const result = await enhanceLeakContextAction({
        codeSnippet: leakToEnhance.contextSnippet,
        apiKeyType: leakToEnhance.keyType,
      });
      
      setLeaks(prevLeaks => 
        prevLeaks.map(leak => 
          leak.id === leakId 
            ? { 
                ...leak, 
                enhancedContext: result.enhancedContext, 
                isLikelyLeak: result.isLikelyLeak,
                status: leakToEnhance.status === 'validating' ? 'new' : leakToEnhance.status, // revert to original if it was new, or keep current
                lastScanned: new Date().toISOString(),
              } 
            : leak
        )
      );
      toast({
        title: "AI Analysis Complete",
        description: `Context enhanced for leak ${leakId}.`,
      });
    } catch (err) {
      console.error("Failed to enhance context:", err);
      setLeaks(prev => prev.map(l => l.id === leakId ? { ...l, status: 'error_enhancing', enhancedContext: "Error during AI analysis.", isLikelyLeak: null } : l));
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: `Could not enhance context for leak ${leakId}.`,
      });
    }
  }, [leaks, toast]);

  return { leaks, isLoading, error, updateLeakStatus, enhanceContext, setLeaks };
}
