
"use client";

import React, { useState } from 'react';
import { Settings, Github, Gitlab } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [githubApiKey, setGithubApiKey] = useState('');
  const [gitlabApiKey, setGitlabApiKey] = useState('');
  // In a real app, you might fetch initial values from a backend or check env vars display state

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, these keys would be securely sent to a backend
    // and stored, likely as environment variables or in a secrets manager.
    // For this prototype, we'll just show a toast.
    console.log('Saving API Keys (Prototype):', { githubApiKey, gitlabApiKey });
    toast({
      title: 'Settings Saved (Prototype)',
      description: (
        <div>
          <p>For the actual scanning to use these keys, please add them to your <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">.env</code> file:</p>
          <ul className="list-disc pl-5 mt-1 text-xs">
            <li><code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITHUB_API_KEY="your_github_key"</code></li>
            <li><code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITLAB_API_KEY="your_gitlab_key"</code></li>
          </ul>
          <p className="mt-2 text-xs">A server restart might be required after updating <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">.env</code>.</p>
        </div>
      ),
      duration: 10000, // Longer duration for this informative toast
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" icon={Settings} description="Configure API keys for enhanced source scanning." />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>API Key Configuration</CardTitle>
            <CardDescription>
              Provide API keys for GitHub and GitLab to improve repository scanning capabilities and avoid rate limits.
              These keys will be used by the backend for scanning if configured.
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
              <Button type="submit">Save API Keys</Button>
            </div>
            <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md bg-background">
              <h4 className="font-semibold text-foreground mb-1">Important Note:</h4>
              <p>
                Saving keys here is for demonstration. For the backend scanning to utilize these keys,
                you must add them to your project's <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">.env</code> file as <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITHUB_API_KEY</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">GITLAB_API_KEY</code>.
                The actual backend integration for API-based scanning is a more complex feature not fully implemented in this prototype.
              </p>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
