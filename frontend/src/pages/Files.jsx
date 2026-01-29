import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sessionsApi, filesApi } from '../services/api';
import { Card, Button, Badge, LoadingSpinner, EmptyState } from '../components/UI';
import { getStatusBadge, formatFileSize, formatRelativeTime, cn } from '../utils';
import {
  FileText,
  Upload,
  ArrowLeft,
  File,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Download
} from 'lucide-react';

export default function Files() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState(sessionId);
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.getAll().then((res) => res.data),
  });

  const { data: filesData, isLoading, refetch } = useQuery({
    queryKey: ['files', selectedSession],
    queryFn: () => selectedSession
      ? filesApi.getBySession(selectedSession).then((res) => res.data)
      : Promise.resolve({ data: { files: [] } }),
    enabled: !!selectedSession,
    refetchInterval: 5000,
  });

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !selectedSession) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await filesApi.upload(selectedSession, formData);
      setSelectedFile(null);
      refetch();
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const sessions = sessionsData?.data?.sessions || [];
  const files = filesData?.data?.files || [];
  const currentSession = sessions.find((s) => s.sessionId === selectedSession);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Files</h1>
        <p className="text-slate-400">Upload and manage files (PDF, Excel, CSV)</p>
      </div>

      {/* Session Selector */}
      {!sessionId && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Select a Session</h2>
          {sessions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No sessions available"
              description="Create a session first to upload files"
              action={
                <Button onClick={() => navigate('/sessions')}>
                  Go to Sessions
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.sessionId)}
                  className={cn(
                    'iso-card p-4 text-left transition-all duration-300',
                    selectedSession === session.sessionId
                      ? 'border-purple-500/50 shadow-lg shadow-purple-500/20'
                      : 'hover:border-purple-500/30'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="text-purple-400" size={20} />
                    <h3 className="font-semibold text-white">{session.sessionId}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={session.status === 'connected' ? 'success' : 'warning'}>
                      {session.status}
                    </Badge>
                    <span className="text-slate-400">
                      {session._count?.files || 0} files
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Files List */}
      {selectedSession && (
        <>
          {/* Back Button */}
          {!sessionId && (
            <Button
              icon={ArrowLeft}
              variant="secondary"
              onClick={() => setSelectedSession(null)}
              className="mb-4"
            >
              Back to Sessions
            </Button>
          )}

          {/* Session Info */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="text-purple-400" size={24} />
                <div>
                  <h2 className="text-xl font-semibold text-white">{currentSession?.sessionId}</h2>
                  <p className="text-sm text-slate-400">{currentSession?.phoneNumber || 'Not connected'}</p>
                </div>
              </div>
              <Badge variant={currentSession?.status === 'connected' ? 'success' : 'warning'}>
                {currentSession?.status}
              </Badge>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleFileUpload} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="flex-1 iso-input cursor-pointer"
                />
                <Button
                  type="submit"
                  icon={Upload}
                  disabled={!selectedFile}
                >
                  Upload
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Supported formats: PDF, Excel (.xlsx, .xls), CSV
              </p>
            </form>
          </Card>

          {/* Files */}
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <LoadingSpinner size="lg" />
            </div>
          ) : files.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No files yet"
              description="Upload a file to get started"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <Card key={file.id}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="iso-icon">
                      <File className="text-cyan-400" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{file.fileName}</h3>
                      <p className="text-sm text-slate-400">{formatFileSize(file.fileSize)}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mb-4">
                    <Badge
                      variant={
                        file.uploadStatus === 'completed'
                          ? 'success'
                          : file.uploadStatus === 'processing'
                          ? 'warning'
                          : file.uploadStatus === 'failed'
                          ? 'error'
                          : 'default'
                      }
                    >
                      {file.uploadStatus === 'processing' && <Loader2 size={12} className="inline-block mr-1 animate-spin" />}
                      {file.uploadStatus === 'completed' && <CheckCircle size={12} className="inline-block mr-1" />}
                      {file.uploadStatus === 'pending' && <Clock size={12} className="inline-block mr-1" />}
                      {file.uploadStatus === 'failed' && <XCircle size={12} className="inline-block mr-1" />}
                      {file.uploadStatus.charAt(0).toUpperCase() + file.uploadStatus.slice(1)}
                    </Badge>
                  </div>

                  {/* Details */}
                  <div className="text-sm space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type</span>
                      <span className="text-white">{file.fileType}</span>
                    </div>
                    {file.processedAt && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Processed</span>
                        <span className="text-white">{formatRelativeTime(file.processedAt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Uploaded</span>
                      <span className="text-white">{formatRelativeTime(file.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {file.uploadStatus === 'completed' && (
                    <Button
                      icon={Download}
                      className="w-full"
                      onClick={() => {
                        // Download logic would go here
                        console.log('Download file:', file.id);
                      }}
                    >
                      Download
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
