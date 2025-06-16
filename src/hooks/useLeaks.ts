
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { LeakedKey, LeakStatus } from '@/lib/types';
import { mockLeaks } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';
import { enhanceLeakContextAction, validateLeakedKeyAction } from '@/app/actions';

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakedKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
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
    // Toast is often too noisy for simple status updates, enable if desired.
    // toast({
    //   title: "Status Updated",
    //   description: `Leak ${id} status changed to ${status.replace("_", " ")}.`,
    // });
  }, []);

  const enhanceContext = useCallback(async (leakId: string) => {
    const leakToEnhance = leaks.find(l => l.id === leakId);
    if (!leakToEnhance) {
      toast({ variant: "destructive", title: "Error", description: "Leak not found." });
      return;
    }

    const originalStatus = leakToEnhance.status;
    updateLeakStatus(leakId, 'enhancing_context');

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
                status: (originalStatus === 'enhancing_context' || originalStatus === 'error_enhancing_context') ? 'new' : originalStatus,
                lastScanned: new Date().toISOString(),
              } 
            : leak
        )
      );
      toast({
        title: "AI Context Analysis Complete",
        description: `Context enhanced for leak ${leakId}.`,
      });
    } catch (err) {
      console.error("Failed to enhance context:", err);
      updateLeakStatus(leakId, 'error_enhancing_context');
      setLeaks(prev => prev.map(l => l.id === leakId ? { ...l, enhancedContext: "Error during AI context analysis.", isLikelyLeak: null } : l));
      toast({
        variant: "destructive",
        title: "AI Context Analysis Failed",
        description: `Could not enhance context for leak ${leakId}.`,
      });
    }
  }, [leaks, toast, updateLeakStatus]);

  const validateKey = useCallback(async (leakId: string) => {
    const leakToValidate = leaks.find(l => l.id === leakId);
    if (!leakToValidate) {
      toast({ variant: "destructive", title: "Error", description: "Leak not found." });
      return;
    }

    const originalStatus = leakToValidate.status;
    updateLeakStatus(leakId, 'validating_key');

    try {
      const result = await validateLeakedKeyAction({
        key: leakToValidate.apiKeyPreview, // Assuming apiKeyPreview is enough, or use a placeholder for the full key if available
        keyType: leakToValidate.keyType,
        sourceUrl: leakToValidate.sourceUrl,
      });
      
      setLeaks(prevLeaks => 
        prevLeaks.map(leak => 
          leak.id === leakId 
            ? { 
                ...leak, 
                isValid: result.isValid,
                accessibleResources: result.accessibleResources,
                riskLevel: result.riskLevel,
                status: (originalStatus === 'validating_key' || originalStatus === 'error_validating_key') ? 'new' : originalStatus,
                lastValidatedTimestamp: new Date().toISOString(),
              } 
            : leak
        )
      );
      toast({
        title: "AI Key Validation Complete",
        description: `Key validation performed for leak ${leakId}.`,
      });
    } catch (err) {
      console.error("Failed to validate key:", err);
      updateLeakStatus(leakId, 'error_validating_key');
      setLeaks(prev => prev.map(l => l.id === leakId ? { ...l, isValid: null, accessibleResources: "Error during AI key validation.", riskLevel: null } : l));
      toast({
        variant: "destructive",
        title: "AI Key Validation Failed",
        description: `Could not validate key for leak ${leakId}.`,
      });
    }
  }, [leaks, toast, updateLeakStatus]);

  return { leaks, isLoading, error, updateLeakStatus, enhanceContext, validateKey, setLeaks };
}
