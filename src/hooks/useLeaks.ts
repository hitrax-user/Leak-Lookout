
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { LeakedKey, LeakStatus, LeakedKeyFromFirestore } from '@/lib/types';
// import { mockLeaks } from '@/lib/mockData'; // Will be replaced by Firestore
import { useToast } from '@/hooks/use-toast';
import { enhanceLeakContextAction, validateLeakedKeyAction } from '@/app/actions';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { collection, onSnapshot, orderBy, query, doc, updateDoc, Timestamp } from 'firebase/firestore';

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakedKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const leaksCollectionRef = collection(db, 'leaks');
    // Order by detectionTimestamp descending
    const q = query(leaksCollectionRef, orderBy('detectionTimestamp', 'desc'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedLeaks: LeakedKey[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as LeakedKeyFromFirestore;
          // Convert Firestore Timestamps to ISO strings
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
            id: docSnap.id, // Use Firestore document ID
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
        // Fallback to mock data or empty array if Firestore fails
        // setLeaks(mockLeaks.sort((a,b) => new Date(b.detectionTimestamp).getTime() - new Date(a.detectionTimestamp).getTime()));
        setLeaks([]);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error Loading Data",
          description: "Could not fetch leaks from the database.",
        });
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [toast]);

  const updateLeakStatusInFirestore = async (id: string, status: LeakStatus) => {
    const leakDocRef = doc(db, 'leaks', id);
    try {
      await updateDoc(leakDocRef, { status });
      // Optimistic update handled by onSnapshot, or can be done here:
      // setLeaks(prevLeaks => prevLeaks.map(leak => leak.id === id ? { ...leak, status } : leak));
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
    updateLeakStatusInFirestore(leakId, 'enhancing_context'); // Update status in Firestore

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
        lastScanned: new Date().toISOString(), // Store as ISO string
      });
      // Firestore onSnapshot will update the local state
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
    updateLeakStatusInFirestore(leakId, 'validating_key'); // Update status in Firestore

    try {
      const result = await validateLeakedKeyAction({
        // This should ideally be the actual key, but apiKeyPreview is used for safety in this prototype.
        // In a real system, you'd need a secure way to handle the actual key for validation if absolutely necessary
        // or rely on metadata/provider checks if possible without exposing the key.
        key: leakToValidate.apiKeyPreview, // CAUTION: This is a preview. Real validation might need the full key.
        keyType: leakToValidate.keyType,
        sourceUrl: leakToValidate.sourceUrl,
      });
      
      const leakDocRef = doc(db, 'leaks', leakId);
      await updateDoc(leakDocRef, {
        isValid: result.isValid,
        accessibleResources: result.accessibleResources,
        riskLevel: result.riskLevel,
        status: (originalStatus === 'validating_key' || originalStatus === 'error_validating_key') ? 'new' : originalStatus,
        lastValidatedTimestamp: new Date().toISOString(), // Store as ISO string
      });
       // Firestore onSnapshot will update the local state
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

  // Expose setLeaks for potential direct manipulation if ever needed (e.g. after a bulk operation not via snapshot)
  return { leaks, isLoading, error, updateLeakStatus, enhanceContext, validateKey, setLeaks };
}
