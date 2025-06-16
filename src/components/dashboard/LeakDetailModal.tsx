
"use client";

import React, { useState, useEffect } from 'react';
import type { LeakedKey, LeakStatus } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Info, Loader2, RefreshCw, ShieldCheck, Wand2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ApiKeyIcon from './ApiKeyIcon';
import LeakStatusBadge from './LeakStatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRemediationStepsAction } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

interface LeakDetailModalProps {
  leak: LeakedKey | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: LeakStatus) => void;
  onEnhanceContext: (id: string) => Promise<void>;
  onValidateKey: (id: string) => Promise<void>;
}

export default function LeakDetailModal({ leak, isOpen, onClose, onUpdateStatus, onEnhanceContext, onValidateKey }: LeakDetailModalProps) {
  const [isGeneratingRemediation, setIsGeneratingRemediation] = useState(false);
  const [remediationSteps, setRemediationSteps] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (leak) {
      setRemediationSteps(null); 
    }
  }, [leak]);

  if (!leak) return null;

  const handleGenerateRemediation = async () => {
    if (!leak) return;
    setIsGeneratingRemediation(true);
    setRemediationSteps(null);
    try {
      const result = await generateRemediationStepsAction({
        keyType: leak.keyType,
        sourceUrl: leak.sourceUrl,
        contextSnippet: leak.contextSnippet,
      });
      setRemediationSteps(result.remediationSteps);
    } catch (error) {
      console.error("Error generating remediation steps:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate remediation steps.' });
      setRemediationSteps("Could not generate remediation steps at this time.");
    } finally {
      setIsGeneratingRemediation(false);
    }
  };
  
  const isEnhancingContext = leak.status === 'enhancing_context';
  const isValidatingKey = leak.status === 'validating_key';
  const hasEnhancedContext = leak.enhancedContext !== null;
  const hasValidatedKey = leak.isValid !== null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
            <ApiKeyIcon type={leak.keyType} className="h-7 w-7 text-primary" />
            Leak Details: {leak.apiKeyPreview}
          </DialogTitle>
          <DialogDescription>
            Source: <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{leak.sourceUrl}</a>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow pr-6 -mr-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-headline">Leak Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoItem label="Key Type" value={leak.keyType} />
                  <InfoItem label="Key Hash" value={leak.keyHash} isMonospace />
                  <InfoItem label="Detected" value={format(parseISO(leak.detectionTimestamp), "PPP p")} />
                  <InfoItem label="Status">
                    <LeakStatusBadge status={leak.status} />
                  </InfoItem>
                  {leak.entropy && <InfoItem label="Entropy" value={leak.entropy.toFixed(2)} />}
                  {leak.repository && <InfoItem label="Repository" value={leak.repository} />}
                  {leak.filePath && <InfoItem label="File Path" value={leak.filePath} isMonospace />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-headline">Context Snippet</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap font-code">
                    <code>{leak.contextSnippet}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Wand2 className="text-primary h-5 w-5" /> AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Context Enhancement Section */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Context Enhancement</h4>
                    {isEnhancingContext && (
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex items-center text-xs text-muted-foreground pt-1">
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          AI is analyzing context...
                        </div>
                      </div>
                    )}
                    {!isEnhancingContext && leak.isLikelyLeak !== null && (
                      <>
                        <InfoItem label="Likely a Leak?" size="xs">
                          <Badge variant={leak.isLikelyLeak ? "destructive" : "default"} className="text-xs">
                            {leak.isLikelyLeak ? <AlertCircle className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                            {leak.isLikelyLeak ? 'Yes' : 'No'}
                          </Badge>
                        </InfoItem>
                        <p className="text-xs text-muted-foreground">{leak.enhancedContext}</p>
                        {leak.lastScanned && <p className="text-xs text-muted-foreground/70 pt-1">Analyzed: {format(parseISO(leak.lastScanned), "Pp")}</p>}
                      </>
                    )}
                    {!isEnhancingContext && leak.enhancedContext === null && leak.status !== 'error_enhancing_context' && (
                      <p className="text-xs text-muted-foreground"><Info className="inline mr-1 h-3 w-3" />Not yet analyzed.</p>
                    )}
                    {leak.status === 'error_enhancing_context' && (
                       <p className="text-xs text-destructive flex items-center"><AlertCircle className="inline mr-1 h-3 w-3" />Analysis error.</p>
                    )}
                    <Button 
                      onClick={() => onEnhanceContext(leak.id)} 
                      disabled={isEnhancingContext || isValidatingKey} 
                      size="sm" 
                      variant="outline"
                      className="w-full mt-2 text-xs"
                    >
                      {isEnhancingContext ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                      {hasEnhancedContext ? 'Re-analyze Context' : 'Analyze Context'}
                    </Button>
                  </div>
                  
                  <Separator />

                  {/* Key Validation Section */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Key Validation</h4>
                    {isValidatingKey && (
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex items-center text-xs text-muted-foreground pt-1">
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          AI is validating key...
                        </div>
                      </div>
                    )}
                    {!isValidatingKey && leak.isValid !== null && (
                      <div className="space-y-1 text-xs">
                        <InfoItem label="Is Valid Key?" size="xs">
                          <Badge variant={leak.isValid ? "destructive" : "default"} className="text-xs">
                            {leak.isValid ? <AlertCircle className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                            {leak.isValid ? 'Valid' : 'Invalid / Inactive'}
                          </Badge>
                        </InfoItem>
                        <InfoItem label="Accessible Resources" value={leak.accessibleResources || "N/A"} size="xs" />
                        <InfoItem label="Risk Level" size="xs">
                            <Badge variant={leak.riskLevel === "high" ? "destructive" : leak.riskLevel === "medium" ? "secondary" : "default"} className="capitalize text-xs">
                                {leak.riskLevel || "N/A"}
                            </Badge>
                        </InfoItem>
                        {leak.lastValidatedTimestamp && <p className="text-xs text-muted-foreground/70 pt-1">Validated: {format(parseISO(leak.lastValidatedTimestamp), "Pp")}</p>}
                      </div>
                    )}
                     {!isValidatingKey && leak.isValid === null && leak.status !== 'error_validating_key' && (
                       <p className="text-xs text-muted-foreground"><Info className="inline mr-1 h-3 w-3" />Not yet validated.</p>
                    )}
                    {leak.status === 'error_validating_key' && (
                       <p className="text-xs text-destructive flex items-center"><AlertCircle className="inline mr-1 h-3 w-3" />Validation error.</p>
                    )}
                     <Button 
                      onClick={() => onValidateKey(leak.id)} 
                      disabled={isValidatingKey || isEnhancingContext}
                      size="sm" 
                      variant="outline"
                      className="w-full mt-2 text-xs"
                    >
                      {isValidatingKey ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-2 h-3 w-3" />}
                      {hasValidatedKey ? 'Re-validate Key' : 'Validate Key'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-headline">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(['new', 'investigating', 'error_enhancing_context', 'error_validating_key'] as LeakStatus[]).includes(leak.status) && (
                    <Button onClick={() => onUpdateStatus(leak.id, 'investigating')} variant="outline" className="w-full">Mark as Investigating</Button>
                  )}
                  {(['new', 'investigating', 'enhancing_context', 'validating_key'] as LeakStatus[]).includes(leak.status) && (
                     <Button onClick={() => onUpdateStatus(leak.id, 'false_positive')} variant="outline" className="w-full">Mark as False Positive</Button>
                  )}
                  {leak.status !== 'remediated' && (
                    <Button onClick={() => onUpdateStatus(leak.id, 'remediated')} variant="outline" className="w-full">Mark as Remediated</Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Separator className="my-6" />

          <div>
            <h3 className="text-xl font-semibold mb-3 font-headline">Remediation Steps</h3>
            {isGeneratingRemediation && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center text-sm text-muted-foreground pt-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating AI-powered remediation steps...
                </div>
              </div>
            )}
            {!isGeneratingRemediation && remediationSteps && (
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-4 rounded-md">
                <div dangerouslySetInnerHTML={{ __html: remediationSteps.replace(/\n/g, '<br />') }} />
              </div>
            )}
            {!remediationSteps && !isGeneratingRemediation && (
              <p className="text-muted-foreground text-sm">Click the button below to generate AI-powered remediation steps for this leak.</p>
            )}
            <Button 
              onClick={handleGenerateRemediation} 
              disabled={isGeneratingRemediation}
              className="mt-4"
            >
              {isGeneratingRemediation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Remediation Steps
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const InfoItem = ({ label, value, children, isMonospace = false, size = "sm" }: { label: string; value?: string | number; children?: React.ReactNode, isMonospace?: boolean, size?: "xs" | "sm" }) => (
  <div className={cn("flex flex-col sm:flex-row sm:justify-between", size === "sm" ? "text-sm" : "text-xs")}>
    <dt className="font-medium text-muted-foreground">{label}:</dt>
    <dd className={cn("mt-1 sm:mt-0 text-foreground", isMonospace && "font-code")}>
      {children || value}
    </dd>
  </div>
);
