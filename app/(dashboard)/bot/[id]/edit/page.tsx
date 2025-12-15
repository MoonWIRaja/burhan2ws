'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { useToast } from '@/lib/hooks/use-toast';
import { JsonEditor } from '@/components/bot/json-editor';
import {
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  Code,
} from 'lucide-react';

interface BotFile {
  id: string;
  fileName: string;
  fileType: string;
  content: string;
  isMain: boolean;
}

interface BotConfig {
  id: string;
  name: string;
  description?: string;
  files: BotFile[];
}

const FILE_TYPE_EXTENSIONS: Record<string, string> = {
  javascript: '.js',
  json: '.json',
  typescript: '.ts',
};

const EXTENSION_TO_TYPE: Record<string, string> = {
  js: 'javascript',
  json: 'json',
  ts: 'typescript',
};

export default function BotEditorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const configId = params.id as string;

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [files, setFiles] = useState<BotFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileForm, setNewFileForm] = useState({
    fileName: '',
    fileType: 'javascript',
  });

  useEffect(() => {
    if (configId) {
      fetchConfig();
    }
  }, [configId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/bot/config/${configId}`);
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setFiles(data.data.files || []);
        if (data.data.files && data.data.files.length > 0) {
          const mainFile = data.data.files.find((f: BotFile) => f.isMain) || data.data.files[0];
          setSelectedFileId(mainFile.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bot config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bot config',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!config || files.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/bot/config/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          files: files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            fileType: f.fileType,
            content: f.content,
            isMain: f.isMain,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Bot config saved!',
          variant: 'success',
        });
        fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to save bot config');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save bot config',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileContentChange = (content: string) => {
    if (!selectedFileId) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFileId ? { ...f, content } : f))
    );
  };

  const handleAddFile = async () => {
    if (!newFileForm.fileName) {
      toast({
        title: 'Error',
        description: 'File name is required',
        variant: 'destructive',
      });
      return;
    }

    const newFile: BotFile = {
      id: `new-${Date.now()}`,
      fileName: newFileForm.fileName,
      fileType: newFileForm.fileType,
      content: '',
      isMain: files.length === 0, // First file is main
    };

    setFiles((prev) => [...prev, newFile]);
    setSelectedFileId(newFile.id);
    setNewFileDialogOpen(false);
    setNewFileForm({ fileName: '', fileType: 'javascript' });
  };

  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      toast({
        title: 'Error',
        description: 'Cannot delete the last file',
        variant: 'destructive',
      });
      return;
    }

    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      if (selectedFileId === fileId) {
        setSelectedFileId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleSetMainFile = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => ({ ...f, isMain: f.id === fileId }))
    );
  };

  const selectedFile = files.find((f) => f.id === selectedFileId);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-dim)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit: ${config.name}`}
        subtitle="Code editor for bot configuration"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File List */}
        <div className="w-64 border-r neon-border bg-[var(--panel)] flex flex-col">
          <div className="p-4 border-b neon-border">
            <Button
              variant="neon"
              size="sm"
              className="w-full"
              onClick={() => setNewFileDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New File
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-2 rounded mb-1 cursor-pointer transition-colors ${
                  selectedFileId === file.id
                    ? 'bg-[var(--neon-color-primary)]/20 neon-border border'
                    : 'hover:bg-[var(--panel-hover)]'
                }`}
                onClick={() => setSelectedFileId(file.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{file.fileName}</span>
                    {file.isMain && (
                      <span className="text-xs px-1 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] flex-shrink-0">
                        Main
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!file.isMain && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetMainFile(file.id);
                        }}
                        title="Set as main file"
                      >
                        <Code className="h-3 w-3" />
                      </Button>
                    )}
                    {files.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[var(--neon-red)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        title="Delete file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t neon-border">
            <Button
              variant="outline"
              className="w-full mb-2"
              onClick={() => router.push('/bot')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="neon"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="p-4 border-b neon-border bg-[var(--panel)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono text-sm">{selectedFile.fileName}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]">
                      {selectedFile.fileType}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                <JsonEditor
                  value={selectedFile.content}
                  onChange={handleFileContentChange}
                  height="100%"
                  language={selectedFile.fileType === 'json' ? 'json' : 'javascript'}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
              <div className="text-center">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No file selected</p>
                <p className="text-sm mt-2">Create a new file to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Add a new file to your bot configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label variant="neon">File Name *</Label>
              <Input
                variant="neon"
                placeholder="e.g., main.js, config.json"
                value={newFileForm.fileName}
                onChange={(e) => setNewFileForm({ ...newFileForm, fileName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label variant="neon">File Type *</Label>
              <select
                className="w-full px-3 py-2 bg-[var(--panel)] border neon-border rounded text-[var(--text)]"
                value={newFileForm.fileType}
                onChange={(e) => setNewFileForm({ ...newFileForm, fileType: e.target.value })}
              >
                <option value="javascript">JavaScript (.js)</option>
                <option value="json">JSON (.json)</option>
                <option value="typescript">TypeScript (.ts)</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setNewFileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="neon" onClick={handleAddFile}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import { useToast } from '@/lib/hooks/use-toast';
import { JsonEditor } from '@/components/bot/json-editor';
import {
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  Code,
} from 'lucide-react';

interface BotFile {
  id: string;
  fileName: string;
  fileType: string;
  content: string;
  isMain: boolean;
}

interface BotConfig {
  id: string;
  name: string;
  description?: string;
  files: BotFile[];
}

const FILE_TYPE_EXTENSIONS: Record<string, string> = {
  javascript: '.js',
  json: '.json',
  typescript: '.ts',
};

const EXTENSION_TO_TYPE: Record<string, string> = {
  js: 'javascript',
  json: 'json',
  ts: 'typescript',
};

export default function BotEditorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const configId = params.id as string;

  const [config, setConfig] = useState<BotConfig | null>(null);
  const [files, setFiles] = useState<BotFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileForm, setNewFileForm] = useState({
    fileName: '',
    fileType: 'javascript',
  });

  useEffect(() => {
    if (configId) {
      fetchConfig();
    }
  }, [configId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/bot/config/${configId}`);
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setFiles(data.data.files || []);
        if (data.data.files && data.data.files.length > 0) {
          const mainFile = data.data.files.find((f: BotFile) => f.isMain) || data.data.files[0];
          setSelectedFileId(mainFile.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bot config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bot config',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!config || files.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/bot/config/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          files: files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            fileType: f.fileType,
            content: f.content,
            isMain: f.isMain,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Bot config saved!',
          variant: 'success',
        });
        fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to save bot config');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save bot config',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileContentChange = (content: string) => {
    if (!selectedFileId) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFileId ? { ...f, content } : f))
    );
  };

  const handleAddFile = async () => {
    if (!newFileForm.fileName) {
      toast({
        title: 'Error',
        description: 'File name is required',
        variant: 'destructive',
      });
      return;
    }

    const newFile: BotFile = {
      id: `new-${Date.now()}`,
      fileName: newFileForm.fileName,
      fileType: newFileForm.fileType,
      content: '',
      isMain: files.length === 0, // First file is main
    };

    setFiles((prev) => [...prev, newFile]);
    setSelectedFileId(newFile.id);
    setNewFileDialogOpen(false);
    setNewFileForm({ fileName: '', fileType: 'javascript' });
  };

  const handleDeleteFile = (fileId: string) => {
    if (files.length === 1) {
      toast({
        title: 'Error',
        description: 'Cannot delete the last file',
        variant: 'destructive',
      });
      return;
    }

    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      if (selectedFileId === fileId) {
        setSelectedFileId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleSetMainFile = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => ({ ...f, isMain: f.id === fileId }))
    );
  };

  const selectedFile = files.find((f) => f.id === selectedFileId);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-dim)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Edit: ${config.name}`}
        subtitle="Code editor for bot configuration"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File List */}
        <div className="w-64 border-r neon-border bg-[var(--panel)] flex flex-col">
          <div className="p-4 border-b neon-border">
            <Button
              variant="neon"
              size="sm"
              className="w-full"
              onClick={() => setNewFileDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New File
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-2 rounded mb-1 cursor-pointer transition-colors ${
                  selectedFileId === file.id
                    ? 'bg-[var(--neon-color-primary)]/20 neon-border border'
                    : 'hover:bg-[var(--panel-hover)]'
                }`}
                onClick={() => setSelectedFileId(file.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{file.fileName}</span>
                    {file.isMain && (
                      <span className="text-xs px-1 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] flex-shrink-0">
                        Main
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!file.isMain && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetMainFile(file.id);
                        }}
                        title="Set as main file"
                      >
                        <Code className="h-3 w-3" />
                      </Button>
                    )}
                    {files.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[var(--neon-red)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        title="Delete file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t neon-border">
            <Button
              variant="outline"
              className="w-full mb-2"
              onClick={() => router.push('/bot')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="neon"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="p-4 border-b neon-border bg-[var(--panel)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono text-sm">{selectedFile.fileName}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]">
                      {selectedFile.fileType}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                <JsonEditor
                  value={selectedFile.content}
                  onChange={handleFileContentChange}
                  height="100%"
                  language={selectedFile.fileType === 'json' ? 'json' : 'javascript'}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
              <div className="text-center">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No file selected</p>
                <p className="text-sm mt-2">Create a new file to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Add a new file to your bot configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label variant="neon">File Name *</Label>
              <Input
                variant="neon"
                placeholder="e.g., main.js, config.json"
                value={newFileForm.fileName}
                onChange={(e) => setNewFileForm({ ...newFileForm, fileName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label variant="neon">File Type *</Label>
              <select
                className="w-full px-3 py-2 bg-[var(--panel)] border neon-border rounded text-[var(--text)]"
                value={newFileForm.fileType}
                onChange={(e) => setNewFileForm({ ...newFileForm, fileType: e.target.value })}
              >
                <option value="javascript">JavaScript (.js)</option>
                <option value="json">JSON (.json)</option>
                <option value="typescript">TypeScript (.ts)</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setNewFileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="neon" onClick={handleAddFile}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



