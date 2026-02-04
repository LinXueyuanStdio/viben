'use client';

import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

export function OAuthButtons() {
  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github';
  };

  return (
    <div className="grid gap-2">
      <Button variant="outline" onClick={handleGitHubLogin} type="button">
        <Github className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>
    </div>
  );
}
