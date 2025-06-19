
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Github, Gitlab, PlayCircle, PauseCircle, Info, RefreshCw, Loader2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { triggerManualScanAction, setScanPausedAction, getScanStatusAction } from '@/app/actions';
import type { ScanStatus } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';


export default function SettingsPage() {
  const { toast } = useToast();
  const [githubApiKey, setGithubApiKey] = useState('');
  const [gitlabApiKey, setGitlabApiKey] = useState('');
  
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isTriggeringScan, setIsTriggeringScan] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  const fetchScanStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const status = await getScanStatusAction();
      setScanStatus(status);
    } catch (error) {
      console.error("Failed to fetch scan status:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load scanner status.' });
      setScanStatus({ isPaused: false, lastRunStart: null, lastRunFinish: null, error: "Failed to load" });
    } finally {
      setIsLoadingStatus(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchScanStatus();
  }, [fetchScanStatus]);

  const handleSaveApiKeys = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Saving API Keys (Prototype):', { githubApiKey, gitlabApiKey });
    toast({
      title: 'API Keys Not Saved to Backend',
      description: (
        <div>
          <p>This UI is for demonstration. For the backend scanner to use these keys, please configure them in Firebase Secret Manager as <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITHUB_API_KEY</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITLAB_API_KEY</code> (or as per your environment variable settings for the Cloud Function).</p>
        </div>
      ),
      duration: 10000,
    });
  };

  const handleTriggerManualScan = async () => {
    setIsTriggeringScan(true);
    const result = await triggerManualScanAction();
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      // Optionally re-fetch status after a delay to see updated lastRunStart
      setTimeout(fetchScanStatus, 5000); 
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsTriggeringScan(false);
  };

  const handleTogglePause = async () => {
    if (!scanStatus) return;
    setIsTogglingPause(true);
    const newPausedState = !scanStatus.isPaused;
    const result = await setScanPausedAction(newPausedState);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      setScanStatus(prev => prev ? { ...prev, isPaused: newPausedState } : null);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsTogglingPause(false);
  };
  
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return 'N/A';
    try {
      return format(parseISO(timestamp), "MMM d, yyyy HH:mm:ss");
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" icon={Settings} description="Configure API keys and manage the leak scanner." />

      <Card>
        <CardHeader>
          <CardTitle>Scanner Control</CardTitle>
          <CardDescription>
            Manage and monitor the automated leak scanning service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStatus ? (
            <>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-3/4" />
            </>
          ) : scanStatus?.error ? (
             <p className="text-destructive">Error loading scanner status: {scanStatus.error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Scheduled Scans Status:</span>
                <span className={`text-sm font-semibold ${scanStatus?.isPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                  {scanStatus?.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Scan Started:</span>
                <span className="text-sm text-muted-foreground">{formatTimestamp(scanStatus?.lastRunStart || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Scan Finished:</span>
                <span className="text-sm text-muted-foreground">{formatTimestamp(scanStatus?.lastRunFinish || null)}</span>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button 
            onClick={handleTriggerManualScan} 
            disabled={isTriggeringScan || isLoadingStatus}
            className="w-full sm:w-auto"
          >
            {isTriggeringScan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Run Scan Manually
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTogglePause} 
            disabled={isTogglingPause || isLoadingStatus || scanStatus?.error !== undefined}
            className="w-full sm:w-auto"
          >
            {isTogglingPause ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (scanStatus?.isPaused ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />)}
            {scanStatus?.isPaused ? 'Resume Scheduled Scans' : 'Pause Scheduled Scans'}
          </Button>
           <Button 
            variant="ghost" 
            onClick={fetchScanStatus} 
            disabled={isLoadingStatus}
            size="icon"
            className="w-full sm:w-auto sm:ml-auto"
            aria-label="Refresh scan status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      <form onSubmit={handleSaveApiKeys}>
        <Card>
          <CardHeader>
            <CardTitle>API Key Configuration</CardTitle>
            <CardDescription>
              Provide API keys for GitHub and GitLab. These keys are used by the backend scanning service.
              <br />
              <strong className="text-primary">Important:</strong> For the backend to use these keys, configure them in Firebase Secret Manager as detailed in the README. This UI does not directly save them for backend use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="githubApiKey" className="flex items-center">
                <Github className="mr-2 h-5 w-5" /> GitHub API Key
              </Label>
              <Input
                id="githubApiKey"
                type="password"
                value={githubApiKey}
                onChange={(e) => setGithubApiKey(e.target.value)}
                placeholder="Enter your GitHub Personal Access Token"
              />
              <p className="text-xs text-muted-foreground">
                Requires <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">repo</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">public_repo</code> scopes for comprehensive scanning.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gitlabApiKey" className="flex items-center">
                <Gitlab className="mr-2 h-5 w-5" /> GitLab API Key
              </Label>
              <Input
                id="gitlabApiKey"
                type="password"
                value={gitlabApiKey}
                onChange={(e) => setGitlabApiKey(e.target.value)}
                placeholder="Enter your GitLab Personal Access Token"
              />
              <p className="text-xs text-muted-foreground">
                Requires <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">api</code> or <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">read_api</code> scope.
              </p>
            </div>
            
            <div>
              <Button type="submit">Show Setup Instructions</Button>
            </div>
            <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md bg-background">
              <Info className="inline-block h-4 w-4 mr-1 align-text-bottom" />
              This UI is for demonstration and to remind you of the required keys.
              The actual keys for the backend scanner must be configured in **Firebase Secret Manager** as <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITHUB_API_KEY</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITLAB_API_KEY</code> (or custom names if you changed them in the function's environment settings).
              Refer to the project's README for detailed setup instructions.
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
