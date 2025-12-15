'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  createdAt: string;
  updatedAt: string;
}

export default function BotEditorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileIdParam = searchParams.get('fileId');

  const [files, setFiles] = useState<BotFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(fileIdParam || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileForm, setNewFileForm] = useState({
    fileName: '',
    fileType: 'javascript',
  });

  useEffect(() => {
    fetchFiles();
    if (fileIdParam) {
      setSelectedFileId(fileIdParam);
    }
  }, [fileIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/bot/files');
      const data = await res.json();
      if (data.success) {
        setFiles(data.data || []);
        if (data.data && data.data.length > 0 && !selectedFileId) {
          const mainFile = data.data.find((f: BotFile) => f.isMain) || data.data[0];
          setSelectedFileId(mainFile.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!selectedFileId) return;

    const selectedFile = files.find((f) => f.id === selectedFileId);
    if (!selectedFile) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/bot/files/${selectedFileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedFile.content,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'File saved!',
          variant: 'success',
        });
        fetchFiles();
      } else {
        throw new Error(data.error || 'Failed to save file');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save file',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileContentChange = (content: string | undefined) => {
    if (!selectedFileId) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFileId ? { ...f, content: content || '' } : f))
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

    setIsLoading(true);
    try {
      const res = await fetch('/api/bot/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: newFileForm.fileName,
          fileType: newFileForm.fileType,
          content: '',
          isMain: false,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'File created!',
          variant: 'success',
        });
        setNewFileDialogOpen(false);
        setNewFileForm({ fileName: '', fileType: 'javascript' });
        fetchFiles();
        setSelectedFileId(data.data.id);
      } else {
        throw new Error(data.error || 'Failed to create file');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
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
        const remainingFiles = files.filter((f) => f.id !== fileId);
        if (selectedFileId === fileId) {
          setSelectedFileId(remainingFiles[0]?.id || null);
        }
        setFiles(remainingFiles);
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

  const selectedFile = files.find((f) => f.id === selectedFileId);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        title="Bot Code Editor"
        subtitle="Edit your bot code files"
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-[var(--neon-red)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${file.fileName}"?`)) {
                          handleDeleteFile(file.id);
                        }
                      }}
                      title="Delete file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t neon-border space-y-2">
            <Button
              variant="outline"
              className="w-full"
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
            {selectedFileId && (
              <Button
                variant="outline"
                className="w-full text-[var(--neon-red)] border-[var(--neon-red)] hover:bg-[var(--neon-red)]/10"
                onClick={() => {
                  if (selectedFileId) {
                    if (confirm(`Are you sure you want to delete "${selectedFile?.fileName}"?`)) {
                      handleDeleteFile(selectedFileId);
                    }
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete File
              </Button>
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {selectedFile ? (
            <>
              <div className="p-4 border-b neon-border bg-[var(--panel)] flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono text-sm">{selectedFile.fileName}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]">
                      {selectedFile.fileType}
                    </span>
                    {selectedFile.isMain && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                        Main File
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/bot')}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button variant="neon" size="sm" onClick={handleSave} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-1" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[var(--neon-red)] border-[var(--neon-red)] hover:bg-[var(--neon-red)]/10"
                      disabled={!selectedFileId}
                      onClick={() => {
                        if (selectedFile && confirm(`Are you sure you want to delete "${selectedFile.fileName}"?`)) {
                          handleDeleteFile(selectedFile.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden min-h-0 p-4">
                <div className="h-full w-full">
                  <JsonEditor
                    value={selectedFile.content}
                    onChange={handleFileContentChange}
                    height="100%"
                    language={selectedFile.fileType === 'json' ? 'json' : 'javascript'}
                    className="h-full"
                  />
                </div>
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
              Add a new file to your bot
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
              <Button variant="neon" onClick={handleAddFile} disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


