'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { useToast } from '@/lib/hooks/use-toast';
import {
  Plus,
  Upload,
  Play,
  RotateCw,
  Square,
  FileText,
  Code,
} from 'lucide-react';

interface BotFile {
  id: string;
  fileName: string;
  fileType: string;
  content: string;
  isMain: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BotStatus {
  isActive: boolean;
  isRunning: boolean;
  lastStarted?: string;
  lastStopped?: string;
  activeFileId?: string;
}

const DEFAULT_CODE_EXAMPLES: Record<string, string> = {
  javascript: `// Bot JavaScript Code
// Available context: bot.message, bot.contactPhone, bot.contactName, bot.chatId
// Helper functions: bot.send(text, mediaUrl?, mediaType?), bot.tagContact(tag), bot.log(message)

// Example: Handle /start command
if (bot.message === '/start' || bot.message.toLowerCase() === 'start') {
  await bot.send('Hello Malaysia!!');
}

// Example: Greeting
if (bot.message.toLowerCase().includes('hi') || bot.message.toLowerCase().includes('hello')) {
  await bot.send('Hello! How can I help you?');
}`,
  json: `{
  "rules": [
    {
      "keywords": ["/start", "start"],
      "matchType": "exact",
      "response": "Hello Malaysia!!",
      "priority": 1
    },
    {
      "keywords": ["hi", "hello", "hey"],
      "matchType": "contains",
      "response": "Hello! How can I help you?",
      "priority": 2
    }
  ],
  "greeting": {
    "enabled": true,
    "message": "Welcome! Thank you for contacting us."
  }
}`,
  typescript: `// Bot TypeScript Code
// Available context: bot.message, bot.contactPhone, bot.contactName, bot.chatId
// Helper functions: bot.send(text, mediaUrl?, mediaType?), bot.tagContact(tag), bot.log(message)

// Example: Handle /start command
if (bot.message === '/start' || bot.message.toLowerCase() === 'start') {
  await bot.send('Hello Malaysia!!');
}

// Example: Greeting
if (bot.message.toLowerCase().includes('hi') || bot.message.toLowerCase().includes('hello')) {
  await bot.send('Hello! How can I help you?');
}`,
};

export default function BotPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [files, setFiles] = useState<BotFile[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isActive: false,
    isRunning: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fileName: '',
    fileType: 'javascript',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
    fetchBotStatus();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/bot/files');
      const data = await res.json();
      if (data.success) {
        setFiles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      if (data.success) {
        setBotStatus(data.data || { isActive: false, isRunning: false });
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    }
  };

  const handleCreateFile = async () => {
    if (!createForm.fileName) {
      toast({
        title: 'Error',
        description: 'File name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/bot/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: createForm.fileName,
          fileType: createForm.fileType,
          content: DEFAULT_CODE_EXAMPLES[createForm.fileType] || DEFAULT_CODE_EXAMPLES.javascript,
          isMain: files.length === 0, // First file is main
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('API Error Response:', data);
        throw new Error(data.error || data.details || `HTTP ${res.status}: Failed to create file`);
      }

      if (data.success) {
        toast({
          title: 'Success',
          description: 'File created!',
          variant: 'success',
        });
        setCreateDialogOpen(false);
        setCreateForm({ fileName: '', fileType: 'javascript' });
        fetchFiles();
        // Navigate to editor
        router.push(`/bot/edit?fileId=${data.data.id}`);
      } else {
        throw new Error(data.error || data.details || 'Failed to create file');
      }
    } catch (error: any) {
      console.error('Create file error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create file. Check server console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'javascript';
    const fileTypeMap: Record<string, string> = {
      js: 'javascript',
      json: 'json',
      ts: 'typescript',
      javascript: 'javascript',
      typescript: 'typescript',
    };
    const fileType = fileTypeMap[fileExtension] || 'javascript';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;

        const res = await fetch('/api/bot/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName,
            fileType,
            content,
            isMain: files.length === 0,
          }),
        });

        const data = await res.json();

        if (data.success) {
          toast({
            title: 'Success',
            description: 'File uploaded successfully!',
            variant: 'success',
          });
          fetchFiles();
          // Navigate to editor
          router.push(`/bot/edit?fileId=${data.data.id}`);
        } else {
          throw new Error(data.error || 'Failed to upload file');
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to upload file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBotAction = async (action: 'start' | 'restart' | 'stop') => {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Bot ${action}ed successfully!`,
          variant: 'success',
        });
        fetchBotStatus();
      } else {
        throw new Error(data.error || `Failed to ${action} bot`);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} bot`,
        variant: 'destructive',
      });
    }
  };

  const handleSetMainFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/bot/files/${fileId}/set-main`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Main file updated!',
          variant: 'success',
        });
        fetchFiles();
      } else {
        throw new Error(data.error || 'Failed to set main file');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set main file',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (files.length === 1) {
      toast({
        title: 'Error',
        description: 'Cannot delete the last file',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(`/api/bot/files/${fileId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'File deleted!',
          variant: 'success',
        });
        fetchFiles();
      } else {
        throw new Error(data.error || 'Failed to delete file');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Bot Automation" subtitle="Create code files and manage bot" />

      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="neon">
                  <Plus className="h-4 w-4 mr-2" />
                  Create File
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New File</DialogTitle>
                  <DialogDescription>
                    Enter file name and type
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label variant="neon">File Name *</Label>
                    <Input
                      variant="neon"
                      placeholder="e.g., main.js, bot.json"
                      value={createForm.fileName}
                      onChange={(e) => setCreateForm({ ...createForm, fileName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label variant="neon">File Type *</Label>
                    <select
                      className="w-full px-3 py-2 bg-[var(--panel)] border neon-border rounded text-[var(--text)]"
                      value={createForm.fileType}
                      onChange={(e) => setCreateForm({ ...createForm, fileType: e.target.value })}
                    >
                      <option value="javascript">JavaScript (.js)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="typescript">TypeScript (.ts)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="neon"
                      onClick={handleCreateFile}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.json,.ts,.javascript,.typescript"
              onChange={handleUploadFile}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!botStatus.isRunning ? (
              <Button
                variant="neon"
                onClick={() => handleBotAction('start')}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Bot
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleBotAction('restart')}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleBotAction('stop')}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded ${
            botStatus.isRunning
              ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
              : 'bg-[var(--neon-red)]/20 text-[var(--neon-red)]'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              botStatus.isRunning ? 'bg-[var(--neon-green)]' : 'bg-[var(--neon-red)]'
            }`} />
            <span className="text-sm font-medium">
              Bot Status: {botStatus.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-dim)]">
            <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files yet</p>
            <p className="text-sm mt-2">Create a new file or upload an existing one</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="p-4 rounded-lg neon-border bg-[var(--panel)] hover:bg-[var(--panel-hover)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="h-5 w-5 text-[var(--neon-color-primary)]" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-semibold">{file.fileName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]">
                          {file.fileType}
                        </span>
                        {file.isMain && (
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                            Main
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        Created: {new Date(file.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!file.isMain && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetMainFile(file.id)}
                        title="Set as main file"
                      >
                        Set Main
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/bot/edit?fileId=${file.id}`)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {files.length > 1 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}