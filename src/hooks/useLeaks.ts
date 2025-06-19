
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { LeakedKey, LeakStatus, LeakedKeyFromFirestore } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { enhanceLeakContextAction, validateLeakedKeyAction } from '@/app/actions';
import { db } from '@/lib/firebase'; 
import { collection, onSnapshot, orderBy, query, doc, updateDoc, Timestamp } from 'firebase/firestore';

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakedKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const leaksCollectionRef = collection(db, 'leaks');
    const q = query(leaksCollectionRef, orderBy('detectionTimestamp', 'desc'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedLeaks: LeakedKey[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as LeakedKeyFromFirestore;
          
          const detectionTimestamp = data.detectionTimestamp instanceof Timestamp 
            ? data.detectionTimestamp.toDate().toISOString() 
            : typeof data.detectionTimestamp === 'string' ? data.detectionTimestamp : new Date().toISOString();
          
          const lastScanned = data.lastScanned instanceof Timestamp
            ? data.lastScanned.toDate().toISOString()
            : typeof data.lastScanned === 'string' ? data.lastScanned : null;

          const lastValidatedTimestamp = data.lastValidatedTimestamp instanceof Timestamp
            ? data.lastValidatedTimestamp.toDate().toISOString()
            : typeof data.lastValidatedTimestamp === 'string' ? data.lastValidatedTimestamp : null;

          return {
            ...data,
            id: docSnap.id, 
            detectionTimestamp,
            lastScanned,
            lastValidatedTimestamp,
          } as LeakedKey;
        });
        setLeaks(fetchedLeaks);
        setIsLoading(false);
        setError(null);
      }, 
      (err) => {
        console.error("Error fetching leaks from Firestore:", err);
        setError("Failed to load leaks. Please try again later.");
        setLeaks([]);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error Loading Data",
          description: "Could not fetch leaks from the database.",
        });
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const updateLeakStatusInFirestore = async (id: string, status: LeakStatus) => {
    const leakDocRef = doc(db, 'leaks', id);
    try {
      await updateDoc(leakDocRef, { status });
    } catch (err) {
      console.error("Error updating leak status in Firestore:", err);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: `Could not update status for leak ${id}.`,
      });
    }
  };
  
  const updateLeakStatus = useCallback((id: string, status: LeakStatus) => {
    updateLeakStatusInFirestore(id, status);
  }, [toast]);


  const enhanceContext = useCallback(async (leakId: string) => {
    const leakToEnhance = leaks.find(l => l.id === leakId);
    if (!leakToEnhance) {
      toast({ variant: "destructive", title: "Error", description: "Leak not found." });
      return;
    }

    const originalStatus = leakToEnhance.status;
    updateLeakStatusInFirestore(leakId, 'enhancing_context'); 

    try {
      const result = await enhanceLeakContextAction({
        codeSnippet: leakToEnhance.contextSnippet,
        apiKeyType: leakToEnhance.keyType,
      });
      
      const leakDocRef = doc(db, 'leaks', leakId);
      await updateDoc(leakDocRef, {
        enhancedContext: result.enhancedContext,
        isLikelyLeak: result.isLikelyLeak,
        status: (originalStatus === 'enhancing_context' || originalStatus === 'error_enhancing_context') ? 'new' : originalStatus,
        lastScanned: new Date().toISOString(), 
      });
      toast({
        title: "AI Context Analysis Complete",
        description: `Context enhanced for leak ${leakId}.`,
      });
    } catch (err) {
      console.error("Failed to enhance context:", err);
      updateLeakStatusInFirestore(leakId, 'error_enhancing_context');
      const leakDocRef = doc(db, 'leaks', leakId);
      await updateDoc(leakDocRef, { 
        enhancedContext: "Error during AI context analysis.", 
        isLikelyLeak: null 
      }).catch(console.error);

      toast({
        variant: "destructive",
        title: "AI Context Analysis Failed",
        description: `Could not enhance context for leak ${leakId}.`,
      });
    }
  }, [leaks, toast]); 

  const validateKey = useCallback(async (leakId: string) => {
    const leakToValidate = leaks.find(l => l.id === leakId);
    if (!leakToValidate) {
      toast({ variant: "destructive", title: "Error", description: "Leak not found." });
      return;
    }

    const originalStatus = leakToValidate.status;
    updateLeakStatusInFirestore(leakId, 'validating_key'); 

    try {
      const result = await validateLeakedKeyAction({
        key: leakToValidate.apiKeyPreview, 
        keyType: leakToValidate.keyType,
        sourceUrl: leakToValidate.sourceUrl,
      });
      
      const leakDocRef = doc(db, 'leaks', leakId);
      await updateDoc(leakDocRef, {
        isValid: result.isValid,
        accessibleResources: result.accessibleResources,
        riskLevel: result.riskLevel,
        status: (originalStatus === 'validating_key' || originalStatus === 'error_validating_key') ? 'new' : originalStatus,
        lastValidatedTimestamp: new Date().toISOString(), 
      });
      toast({
        title: "AI Key Validation Complete",
        description: `Key validation performed for leak ${leakId}.`,
      });
    } catch (err) {
      console.error("Failed to validate key:", err);
      updateLeakStatusInFirestore(leakId, 'error_validating_key');
      const leakDocRef = doc(db, 'leaks', leakId);
      await updateDoc(leakDocRef, {
         isValid: null, 
         accessibleResources: "Error during AI key validation.", 
         riskLevel: null 
      }).catch(console.error);

      toast({
        variant: "destructive",
        title: "AI Key Validation Failed",
        description: `Could not validate key for leak ${leakId}.`,
      });
    }
  }, [leaks, toast]); 

  return { leaks, isLoading, error, updateLeakStatus, enhanceContext, validateKey, setLeaks };
}
