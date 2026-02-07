"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconRobot,
  IconPlus,
  IconSend,
  IconMicrophone,
  IconPaperclip,
  IconFile,
  IconFolder,
  IconChevronRight,
  IconChevronLeft,
  IconSearch,
  IconPlayerPlay,
  IconX,
  IconBolt,
  IconCpu,
  IconPlayerStop,
  IconLoader2,
  IconDotsVertical,
  IconTrash,
  IconEdit,
  IconDownload,
  IconBook,
  IconAlertTriangle,
  IconCheck
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatMarkdown } from "@/lib/markdown";
import { useToast } from "@/components/ui/toast";
import { getModelPricing, getPopularModelNames } from "@/lib/ai-models-pricing";

interface BotFile {
  id: string;
  filename: string;
  filePath: string;
  parentPath: string;
  isDirectory: boolean;
  fileSize: number;
  content?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

interface AIModel {
  id: string;
  alias: string;
  modelName: string;
  provider: string;
  isActive: boolean;
  testStatus: string;
  apiEndpoint: string;
  systemPrompt?: string;
  name?: string; // For backward compatibility
}

interface BotConfig {
  isEnabled: boolean;
  botMode?: "normal" | "ai";
  systemPrompt: string | null;
  activeModelId: string | null;
}

interface ChatMessage {
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

export default function BotPage() {
  const { toast, success, error: toastError } = useToast();
  const [activeView, setActiveView] = useState<"chat" | "files">("files");
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<BotFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAiModal, setShowAddAiModal] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // File manager states
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<BotFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<BotFile | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [originalContent, setOriginalContent] = useState(""); // Track unsaved changes
  const [fileManagerView, setFileManagerView] = useState<"list" | "editor">("list");
  const [showNewModal, setShowNewModal] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [savingFile, setSavingFile] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // File action modals
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToRename, setFileToRename] = useState<BotFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<BotFile | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showDeleteModelModal, setShowDeleteModelModal] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AIModel | null>(null);
  const [isDeletingModel, setIsDeletingModel] = useState(false);

  // Code editor states
  const [editorCursorPos, setEditorCursorPos] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const editorRef = React.useRef<HTMLTextAreaElement>(null);

  // IntelliSense keywords by file type
  const INTELLISENSE_KEYWORDS = {
    javascript: [
      "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
      "function", "return", "async", "await", "try", "catch", "finally", "throw",
      "const", "let", "var", "import", "export", "default", "from", "class",
      "constructor", "extends", "new", "this", "super", "static", "get", "set",
      "typeof", "instanceof", "in", "of", "true", "false", "null", "undefined",
      "console.log", "console.error", "console.warn", "JSON.stringify", "JSON.parse",
      "Array.from", "Array.isArray", "Object.keys", "Object.values", "Object.entries",
      "map", "filter", "reduce", "find", "forEach", "some", "every", "includes",
      "push", "pop", "shift", "unshift", "slice", "splice", "length", "split", "join"
    ],
    json: [
      "true", "false", "null",
      "\"name\"", "\"value\"", "\"type\"", "\"enabled\"", "\"disabled\"",
      "\"message\"", "\"text\"", "\"data\"", "\"id\"", "\"title\"", "\"description\"",
      "\"url\"", "\"path\"", "\"file\"", "\"content\"", "\"config\"", "\"settings\"",
      "\"handlers\"", "\"flows\"", "\"prompts\"", "\"responses\"", "\"keywords\"",
      "\"trigger\"", "\"action\"", "\"condition\"", "\"else\"", "\"steps\""
    ],
    typescript: [
      "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
      "function", "return", "async", "await", "try", "catch", "finally", "throw",
      "const", "let", "var", "import", "export", "default", "from", "class",
      "interface", "type", "enum", "namespace", "module", "declare",
      "constructor", "extends", "implements", "new", "this", "super", "static",
      "public", "private", "protected", "readonly", "abstract",
      "string", "number", "boolean", "void", "any", "never", "unknown", "null",
      "undefined", "object", "Array", "Promise", "Record", "Map", "Set"
    ],
    text: [
      "Hello", "Hi", "Welcome", "Thank you", "Please", "Sorry",
      "[NAME]", "[USER]", "[PHONE]", "[EMAIL]", "[DATE]", "[TIME]"
    ]
  };

  const getFileLanguage = (filename: string): keyof typeof INTELLISENSE_KEYWORDS => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'jsx': case 'mjs': case 'cjs': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'txt': case 'md': return 'text';
      default: return 'javascript';
    }
  };

  const getAutocompleteSuggestions = (filename: string, word: string): string[] => {
    if (!word || word.length < 1) return [];
    const lang = getFileLanguage(filename);
    const keywords = INTELLISENSE_KEYWORDS[lang];
    return keywords.filter(k => k.toLowerCase().startsWith(word.toLowerCase())).slice(0, 10);
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setFileContent(newValue);
    setEditorCursorPos(e.target.selectionStart);

    // Get current word for autocomplete
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const textBefore = newValue.substring(0, cursorPos);
    const wordMatch = textBefore.match(/[\w.]+$/);
    const word = wordMatch ? wordMatch[0] : "";

    if (selectedFile) {
      const suggestions = getAutocompleteSuggestions(selectedFile.filename, word);
      if (suggestions.length > 0 && word.length >= 1) {
        setAutocompleteItems(suggestions);
        setAutocompleteIndex(0);
        setCurrentWord(word);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    }
  };

  const insertAutocomplete = (item: string) => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = fileContent.substring(0, cursorPos);
    const textAfter = fileContent.substring(cursorPos);
    const wordStartPos = textBefore.lastIndexOf(currentWord);

    const newContent = fileContent.substring(0, wordStartPos) + item + textAfter;
    setFileContent(newContent);
    setShowAutocomplete(false);

    // Set cursor position after inserted word
    setTimeout(() => {
      const newPos = wordStartPos + item.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev + 1) % autocompleteItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocompleteIndex(prev => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertAutocomplete(autocompleteItems[autocompleteIndex]);
      } else if (e.key === "Escape") {
        setShowAutocomplete(false);
      }
    }
  };

  const hasUnsavedChanges = () => fileContent !== originalContent;

  const closeEditor = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedModal(true);
    } else {
      backToFileList();
    }
  };

  const backToFileList = () => {
    setFileManagerView("list");
    setSelectedFile(null);
    setFileContent("");
    setOriginalContent("");
    setShowAutocomplete(false);
  };

  const saveAndBack = async () => {
    await saveFile();
    backToFileList();
  };

  const discardAndBack = () => {
    backToFileList();
  };

  // Add model form states
  const [modelAlias, setModelAlias] = useState("");          // Display name e.g., "My Bot"
  const [modelName, setModelName] = useState("");            // Model ID e.g., "gpt-4", "glm-4.7"
  const [apiEndpoint, setApiEndpoint] = useState("");        // Custom API endpoint
  const [apiKey, setApiKey] = useState("");                  // API Key
  const [systemPrompt, setSystemPrompt] = useState("");      // Optional system prompt
  const [inputPricePer1M, setInputPricePer1M] = useState(""); // Input price per 1M tokens (USD)
  const [outputPricePer1M, setOutputPricePer1M] = useState(""); // Output price per 1M tokens (USD)
  const [showModelSuggestions, setShowModelSuggestions] = useState(false); // Show model name suggestions
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  // Edit model states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Knowledge Base upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-populate pricing when model name changes
  const handleModelNameChange = (value: string) => {
    setModelName(value);
    const pricing = getModelPricing(value);
    if (pricing) {
      setInputPricePer1M(pricing.inputPrice.toFixed(2));
      setOutputPricePer1M(pricing.outputPrice.toFixed(2));
    }
    setShowModelSuggestions(value.length > 0);
  };

  useEffect(() => {
    fetchBotData();
  }, []);

  useEffect(() => {
    if (activeView === "files") {
      fetchFiles(currentPath);
    }
  }, [currentPath, activeView]);

  const fetchBotData = async () => {
    try {
      setLoading(true);
      const [configRes, modelsRes] = await Promise.all([
        fetch("/api/bot/config", { credentials: "include" }),
        fetch("/api/bot/models", { credentials: "include" }),
      ]);

      const config = await configRes.json();
      const models = await modelsRes.json();

      setBotConfig(config);
      setAiModels(Array.isArray(models) ? models : []);

      // Fetch knowledge files from /knowledge folder in File Manager
      const knowledgeRes = await fetch("/api/bot/files?path=%2Fknowledge&mode=ai", { credentials: "include" });
      const knowledgeFiles = await knowledgeRes.json();
      setKnowledgeBase(Array.isArray(knowledgeFiles) ? knowledgeFiles.filter((f: BotFile) => !f.isDirectory) : []);
    } catch (error) {
      console.error("Failed to fetch bot data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (path: string) => {
    try {
      setLoadingFiles(true);
      const res = await fetch(`/api/bot/files?path=${encodeURIComponent(path)}`, { credentials: "include" });
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch files:", error);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const toggleBotEnabled = async () => {
    if (!botConfig) return;
    try {
      const res = await fetch("/api/bot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isEnabled: !botConfig.isEnabled }),
      });
      if (res.ok) {
        setBotConfig({ ...botConfig, isEnabled: !botConfig.isEnabled });
      }
    } catch (error) {
      console.error("Failed to toggle bot:", error);
    }
  };

  const toggleBotMode = async () => {
    if (!botConfig) return;
    // Toggle between normal (off) and ai (on) modes
    const newMode: "normal" | "ai" = botConfig.botMode === "ai" ? "normal" : "ai";
    try {
      const res = await fetch("/api/bot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ botMode: newMode }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBotConfig(updated);
        // Refresh files for the new mode
        setSelectedFile(null);
        setFileContent("");
        setCurrentPath("/");
        fetchFiles("/");

        // Auto-resync default files if switching to AI mode (adds missing /commands folder)
        if (newMode === "ai") {
          try {
            await fetch("/api/bot/files/resync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ mode: "ai" }),
            });
            // Refresh files again to show new folders
            fetchFiles("/");
          } catch (e) {
            console.error("Failed to resync files:", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to toggle bot mode:", error);
    }
  };

  const handleSaveModel = async () => {
    // Validate required fields
    if (!modelAlias.trim() || !modelName.trim() || !apiEndpoint.trim() || !apiKey.trim()) {
      setTestResult("error");
      setTestMessage("Please fill in all required fields");
      return;
    }

    // If not tested yet, run test first
    if (testResult !== "success") {
      await testConnection();
      return;
    }

    // Test passed, now save the model
    try {
      setSavingModel(true);
      const res = await fetch("/api/bot/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          alias: modelAlias,
          modelName: modelName,
          apiEndpoint: apiEndpoint,
          apiKey: apiKey,
          systemPrompt: systemPrompt || null,
          inputPricePer1M: inputPricePer1M || "0.00",
          outputPricePer1M: outputPricePer1M || "0.00",
        }),
      });

      if (res.ok) {
        setShowAddAiModal(false);
        setTestResult(null);
        setTestMessage("");
        // Reset form
        setModelAlias("");
        setModelName("");
        setApiEndpoint("");
        setApiKey("");
        setSystemPrompt("");
        setInputPricePer1M("");
        setOutputPricePer1M("");
        fetchBotData();
      } else {
        const error = await res.json();
        setTestResult("error");
        setTestMessage(error.message || "Failed to save model");
      }
    } catch (error: any) {
      console.error("Failed to save model:", error);
      setTestResult("error");
      setTestMessage(error.message || "Failed to save model");
    } finally {
      setSavingModel(false);
    }
  };

  const testConnection = async () => {
    // Validate required fields
    if (!modelAlias.trim() || !modelName.trim() || !apiEndpoint.trim() || !apiKey.trim()) {
      setTestResult("error");
      setTestMessage("Please fill in all required fields");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestMessage("");

    try {
      const res = await fetch("/api/bot/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelName: modelName,
          apiEndpoint: apiEndpoint,
          apiKey: apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult("success");
        setTestMessage("Connection successful! Model is working.");
      } else {
        const error = await res.json();
        setTestResult("error");
        setTestMessage(error.message || "Connection failed. Please check your settings.");
      }
    } catch (error: any) {
      console.error("Test connection failed:", error);
      setTestResult("error");
      setTestMessage(error.message || "Connection failed. Please check your API endpoint and key.");
    } finally {
      setIsTesting(false);
    }
  };

  const deleteModel = async (modelId: string) => {
    const model = aiModels.find(m => m.id === modelId);
    if (model) {
      setModelToDelete(model);
      setShowDeleteModelModal(true);
    }
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete) return;

    try {
      setIsDeletingModel(true);
      const res = await fetch(`/api/bot/models`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modelId: modelToDelete.id }),
      });
      if (res.ok) {
        fetchBotData();
        success("AI model deleted successfully");
      } else {
        toastError("Failed to delete AI model");
      }
    } catch (error) {
      console.error("Failed to delete model:", error);
      toastError("Failed to delete AI model");
    } finally {
      setIsDeletingModel(false);
      setShowDeleteModelModal(false);
      setModelToDelete(null);
    }
  };

  const cancelDeleteModel = () => {
    setShowDeleteModelModal(false);
    setModelToDelete(null);
  };

  const activateModel = async (modelId: string) => {
    try {
      const res = await fetch(`/api/bot/models/${modelId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        fetchBotData();
      }
    } catch (error) {
      console.error("Failed to activate model:", error);
    }
  };

  const openEditModal = (model: AIModel) => {
    setEditingModelId(model.id);
    setModelAlias(model.alias);
    setModelName(model.modelName);
    setApiEndpoint(model.apiEndpoint);
    setApiKey(""); // Don't pre-fill API key for security
    setSystemPrompt(model.systemPrompt || "");
    // Note: Pricing fields are not loaded in edit mode (user needs to re-enter if changing)
    setInputPricePer1M("");
    setOutputPricePer1M("");
    setIsEditMode(true);
    setShowAddAiModal(true);
    setTestResult(null);
    setTestMessage("");
  };

  const updateModel = async () => {
    if (!editingModelId) return;

    // Validate required fields
    if (!modelAlias.trim() || !modelName.trim() || !apiEndpoint.trim()) {
      setTestResult("error");
      setTestMessage("Please fill in all required fields");
      return;
    }

    // If API key provided, test first; otherwise just update
    if (apiKey.trim()) {
      await testConnection();
      if (testResult !== "success") return;
    }

    try {
      setSavingModel(true);
      const body: any = {
        alias: modelAlias,
        modelName: modelName,
        apiEndpoint: apiEndpoint,
        systemPrompt: systemPrompt || null,
        inputPricePer1M: inputPricePer1M || "0.00",
        outputPricePer1M: outputPricePer1M || "0.00",
      };
      // Only include API key if user entered a new one
      if (apiKey.trim()) {
        body.apiKey = apiKey;
      }

      const res = await fetch(`/api/bot/models/${editingModelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowAddAiModal(false);
        setTestResult(null);
        setTestMessage("");
        setIsEditMode(false);
        setEditingModelId(null);
        // Reset form
        setModelAlias("");
        setModelName("");
        setApiEndpoint("");
        setApiKey("");
        setSystemPrompt("");
        setInputPricePer1M("");
        setOutputPricePer1M("");
        fetchBotData();
      } else {
        const error = await res.json();
        setTestResult("error");
        setTestMessage(error.message || "Failed to update model");
      }
    } catch (error: any) {
      console.error("Failed to update model:", error);
      setTestResult("error");
      setTestMessage(error.message || "Failed to update model");
    } finally {
      setSavingModel(false);
    }
  };

  const createNewItem = async () => {
    if (!newItemName.trim()) return;
    try {
      const res = await fetch("/api/bot/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newItemName,
          parentPath: currentPath,
          isDirectory: showNewModal === "folder",
          content: showNewModal === "file" ? "" : undefined,
        }),
      });
      if (res.ok) {
        setShowNewModal(null);
        setNewItemName("");
        fetchFiles(currentPath);
      }
    } catch (error) {
      console.error("Failed to create:", error);
    }
  };

  const openFile = async (file: BotFile) => {
    if (file.isDirectory) {
      setCurrentPath(file.filePath);
      setSelectedFile(null);
    } else {
      try {
        const res = await fetch(`/api/bot/files/${file.id}`, { credentials: "include" });
        const data = await res.json();
        const content = data.content || "";
        setSelectedFile(data);
        setFileContent(content);
        setOriginalContent(content);
        setFileManagerView("editor");
        setShowAutocomplete(false);
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      setSavingFile(true);
      const res = await fetch(`/api/bot/files/${selectedFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: fileContent }),
      });
      if (res.ok) {
        setOriginalContent(fileContent);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
    } finally {
      setSavingFile(false);
    }
  };

  const deleteFile = async (file: BotFile) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await fetch(`/api/bot/files/${fileToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchFiles(currentPath);
      if (selectedFile?.id === fileToDelete.id) {
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
  };

  const openRenameModal = (file: BotFile) => {
    setFileToRename(file);
    setNewFileName(file.filename);
    setShowRenameModal(true);
  };

  const renameFile = async () => {
    if (!fileToRename || !newFileName.trim()) return;
    try {
      await fetch(`/api/bot/files/${fileToRename.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: newFileName }),
      });
      fetchFiles(currentPath);
      setShowRenameModal(false);
      setFileToRename(null);
      setNewFileName("");
    } catch (error) {
      console.error("Failed to rename:", error);
    }
  };

  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);

      // Check file type - binary files (PDF, DOCX) need special handling
      const binaryExtensions = [".pdf", ".doc", ".docx"];
      const isBinary = binaryExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (isBinary) {
        toastError("Binary files (PDF, DOCX) cannot be uploaded directly. Please create a new file in File Manager and paste the content, or use text files (TXT, MD, JSON).");
        return;
      }

      // Read file content
      const text = await file.text();

      // Upload to bot_files in /knowledge folder (same as File Manager)
      const res = await fetch("/api/bot/files/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          parentPath: "/knowledge",
          content: text,
        }),
      });

      if (res.ok) {
        fetchBotData();
        // Also refresh files to show in File Manager
        fetchFiles("/knowledge");
      } else {
        const error = await res.json();
        toastError(error.error || "Failed to upload file");
      }
    } catch (error) {
      console.error("Failed to upload:", error);
      toastError("Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const deleteKnowledgeFile = async (index: number) => {
    const file = knowledgeBase[index];
    if (!file) return;

    try {
      // Delete from bot_files (same as File Manager)
      await fetch(`/api/bot/files/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchBotData();
      // Also refresh files to update File Manager
      fetchFiles("/knowledge");
    } catch (error) {
      console.error("Failed to delete knowledge file:", error);
    }
  };

  const goUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? "/" + parts.join("/") : "/");
    setSelectedFile(null);
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    
    const userMsg: ChatMessage = { role: "user", content: chatMessage, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatMessage("");

    try {
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: chatMessage }),
      });
      const data = await res.json();
      
      const botMsg: ChatMessage = { role: "bot", content: data.response || "No response", timestamp: new Date() };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = { role: "bot", content: "Error getting response", timestamp: new Date() };
      setChatMessages(prev => [...prev, errorMsg]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-MY", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileIcon = (filename: string, isDirectory: boolean) => {
    if (isDirectory) return <IconFolder className="text-red-400" size={18} />;
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return <IconFile className="text-yellow-500" size={18} />;
      case 'js': case 'ts': return <IconBolt className="text-blue-400" size={18} />;
      case 'md': case 'txt': return <IconFile className="text-gray-400" size={18} />;
      case 'zip': case 'tar': return <IconFile className="text-purple-500" size={18} />;
      default: return <IconFile className="text-blue-500" size={18} />;
    }
  };

  const breadcrumbs = currentPath === "/" ? ["/"] : ["", ...currentPath.split("/").filter(Boolean)];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold font-display text-foreground">Bot Studio</h1>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
            botConfig?.botMode === "ai"
              ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
              : "bg-blue-500/10 text-blue-500 border-blue-500/20"
          )}>
            {botConfig?.botMode === "ai" ? <IconCpu size={12} /> : <IconBolt size={12} />}
            {botConfig?.botMode === "ai" ? "AI Mode" : "Normal Mode"}
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
            botConfig?.isEnabled ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
          )}>
            <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                botConfig?.isEnabled ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            {botConfig?.isEnabled ? "Online" : "Offline"}
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 bg-muted p-1.5 rounded-2xl border border-border">
              <button
                onClick={toggleBotEnabled}
                disabled={!botConfig || botConfig.isEnabled}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  botConfig?.isEnabled
                    ? "text-neutral-400 cursor-not-allowed"
                    : "bg-white dark:bg-neutral-700 text-green-500 shadow-sm hover:bg-green-50"
                )}
              >
                <IconPlayerPlay size={16} /> Start
              </button>
              <button
                onClick={toggleBotEnabled}
                disabled={!botConfig || !botConfig.isEnabled}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  !botConfig?.isEnabled
                    ? "text-neutral-400 cursor-not-allowed"
                    : "bg-white dark:bg-neutral-700 text-red-500 shadow-sm hover:bg-red-50"
                )}
              >
                <IconPlayerStop size={16} /> Stop
              </button>
           </div>

           <button
             onClick={() => setActiveView(activeView === "chat" ? "files" : "chat")}
             className={cn(
               "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border",
               activeView === "files"
                ? "bg-green-500 text-white border-green-500"
                : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
             )}
           >
             {activeView === "files" ? <><IconRobot size={18} /> Test Chat</> : <><IconFolder size={18} /> File Manager</>}
           </button>

           <button
             onClick={() => setShowTutorialModal(true)}
             className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
             title="View tutorial"
           >
             <IconBook size={18} /> Guide
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Main Area - 70% */}
        <div className="lg:w-[70%] flex flex-col overflow-hidden">
          {activeView === "chat" ? (
            <div className="flex-1 flex flex-col bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                    <IconRobot size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">AI Agent Sandbox</p>
                    <p className="text-[10px] text-muted-foreground">
                      Testing: {aiModels.find(m => m.id === botConfig?.activeModelId)?.alias || "No model selected"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-muted/10">
                {chatMessages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Start a conversation to test your bot...
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3 max-w-[80%]", msg.role === "user" && "ml-auto flex-row-reverse")}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                      msg.role === "bot" ? "bg-green-500 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                    )}>
                      {msg.role === "bot" ? <IconRobot size={18} /> : "ME"}
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl",
                      msg.role === "bot" ? "bg-muted/50 dark:bg-card rounded-tl-sm" : "bg-green-500 text-white rounded-tr-sm"
                    )}>
                      <div className="text-sm break-words">{formatMarkdown(msg.content)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-6 border-t border-border bg-white/50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-2 bg-muted/50 dark:bg-neutral-800/80 rounded-2xl p-2 border border-border">
                  <button className="p-2.5 text-muted-foreground hover:text-green-500 rounded-full transition-all">
                    <IconPaperclip size={20} />
                  </button>
                  <button className="p-2.5 text-muted-foreground hover:text-green-500 rounded-full transition-all">
                    <IconMicrophone size={20} />
                  </button>
                  <input 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder="Ask your bot anything..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 text-foreground placeholder:text-muted-foreground/60"
                  />
                  <button 
                    onClick={sendChatMessage}
                    className="w-11 h-11 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all flex items-center justify-center"
                  >
                    <IconSend size={20} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-gradient-to-br from-neutral-900/85 via-neutral-800/90 to-neutral-900/85 border border-white/10 rounded-3xl overflow-hidden shadow-xl backdrop-blur-xl">
              {/* File Manager Header - Only show in list view */}
              {fileManagerView === "list" && (
                <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Current Mode Badge */}
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      botConfig?.botMode === "ai"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    )}>
                      {botConfig?.botMode === "ai" ? <IconCpu size={12} /> : <IconBolt size={12} />}
                      {botConfig?.botMode === "ai" ? "AI Mode" : "Normal Mode"}
                    </div>
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-sm">
                      {breadcrumbs.map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <IconChevronRight size={14} className="text-neutral-500" />}
                          <button
                            onClick={() => {
                              const newPath = i === 0 ? "/" : "/" + breadcrumbs.slice(1, i + 1).join("/");
                              setCurrentPath(newPath);
                              setSelectedFile(null);
                            }}
                            className="text-neutral-400 hover:text-white transition-colors px-1"
                          >
                            {part || "root"}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNewModal("folder")}
                      disabled={botConfig?.isEnabled}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all",
                        botConfig?.isEnabled
                          ? "bg-white/5 text-white/30 cursor-not-allowed"
                          : "bg-white/10 hover:bg-white/20"
                      )}
                    >
                      <IconFolder size={14} /> New Folder
                    </button>
                    <button
                      onClick={() => setShowNewModal("file")}
                      disabled={botConfig?.isEnabled}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all",
                        botConfig?.isEnabled
                          ? "bg-green-500/30 text-white/30 cursor-not-allowed"
                          : "bg-green-500 hover:bg-green-600"
                      )}
                    >
                      <IconFile size={14} /> New File
                    </button>
                    {botConfig?.isEnabled && (
                      <span className="text-[9px] text-amber-400 font-medium ml-1">
                        Stop bot to edit files
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* File List or Editor */}
              <div className={cn(
                "flex-1 overflow-auto",
                fileManagerView === "editor" ? "p-6" : "p-4"
              )}>
                {fileManagerView === "list" ? (
                  <>
                    {loadingFiles ? (
                      <div className="flex items-center justify-center h-full">
                        <IconLoader2 className="animate-spin text-neutral-400" size={32} />
                      </div>
                    ) : files.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                        <IconFolder size={48} className="mb-2 opacity-50" />
                        <p className="text-sm">This folder is empty</p>
                        <p className="text-xs text-neutral-500 mt-1">Create a file or folder to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {currentPath !== "/" && (
                          <button
                            onClick={goUp}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all text-left group"
                          >
                            <IconFolder size={18} className="text-neutral-500" />
                            <span className="text-sm text-neutral-400">..</span>
                          </button>
                        )}
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all group"
                          >
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => openFile(file)}
                            >
                              {getFileIcon(file.filename, file.isDirectory)}
                              <span className="flex-1 text-sm text-neutral-200 truncate">{file.filename}</span>
                              {!file.isDirectory && (
                                <span className="text-xs text-neutral-500">{formatFileSize(file.fileSize)}</span>
                              )}
                              <span className="text-xs text-neutral-500">{formatDate(file.createdAt)}</span>
                            </div>
                            {!botConfig?.isEnabled && (
                              <div className="relative opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRenameModal(file);
                                  }}
                                  className="p-1.5 hover:bg-blue-500/20 rounded text-neutral-400 hover:text-blue-400 transition-all"
                                  title="Rename"
                                >
                                  <IconEdit size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFile(file);
                                  }}
                                  className="p-1.5 hover:bg-red-500/20 rounded text-neutral-400 hover:text-red-400 transition-all"
                                  title="Delete"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Code Editor View */
                  <div className="flex flex-col h-full">
                    {/* Editor Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <button
                        onClick={closeEditor}
                        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
                      >
                        <IconChevronLeft size={18} /> Back
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{selectedFile?.filename}</p>
                          <p className="text-[10px] text-neutral-500">{selectedFile?.filePath}</p>
                        </div>
                        {hasUnsavedChanges() && (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1">
                            <IconAlertTriangle size={10} /> Unsaved
                          </span>
                        )}
                        <button
                          onClick={saveFile}
                          disabled={savingFile || botConfig?.isEnabled}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold transition-all",
                            botConfig?.isEnabled
                              ? "bg-neutral-600 cursor-not-allowed"
                              : "bg-green-500 hover:bg-green-600 disabled:opacity-50"
                          )}
                        >
                          {savingFile ? (
                            <>
                              <IconLoader2 size={14} className="animate-spin" /> Saving...
                            </>
                          ) : (
                            <>
                              <IconCheck size={14} /> Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Editor */}
                    <div className="flex-1 relative bg-neutral-900 rounded-xl overflow-hidden min-h-0">
                      {botConfig?.isEnabled ? (
                        <div className="absolute inset-0 bg-neutral-900/50 z-10 flex items-center justify-center">
                          <div className="text-center">
                            <IconPlayerStop size={32} className="text-amber-500 mx-auto mb-2" />
                            <p className="text-sm text-amber-500 font-bold">File Locked</p>
                            <p className="text-xs text-neutral-400">Stop the bot to edit this file</p>
                          </div>
                        </div>
                      ) : null}

                      {/* Line Numbers */}
                      <div className="absolute left-0 top-0 bottom-0 w-10 bg-neutral-800/50 text-neutral-600 text-xs font-mono pt-4 text-right pr-2 select-none border-r border-white/5">
                        {fileContent.split('\n').map((_, i) => (
                          <div key={i} className="leading-6">{i + 1}</div>
                        ))}
                      </div>

                      {/* Textarea */}
                      <textarea
                        ref={editorRef}
                        value={fileContent}
                        onChange={handleEditorChange}
                        onKeyDown={handleEditorKeyDown}
                        disabled={botConfig?.isEnabled}
                        className={cn(
                          "w-full h-full p-4 pl-12 font-mono text-sm border-none focus:ring-0 resize-none bg-transparent",
                          botConfig?.isEnabled ? "text-neutral-600 cursor-not-allowed" : "text-neutral-200"
                        )}
                        spellCheck={false}
                        style={{ minHeight: "400px", lineHeight: "1.5rem" }}
                      />

                      {/* Autocomplete Dropdown */}
                      {showAutocomplete && !botConfig?.isEnabled && (
                        <div
                          className="absolute z-20 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                          style={{
                            left: `${100 + (currentWord.length * 7)}px`,
                            top: `${(fileContent.substring(0, fileContent.lastIndexOf(currentWord)).split('\n').length) * 24 + 16}px`
                          }}
                        >
                          {autocompleteItems.map((item, index) => (
                            <div
                              key={item}
                              onClick={() => insertAutocomplete(item)}
                              className={cn(
                                "px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2",
                                index === autocompleteIndex
                                  ? "bg-blue-500 text-white"
                                  : "text-neutral-300 hover:bg-neutral-700"
                              )}
                            >
                              <IconBolt size={12} />
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - 30% */}
        <div className="lg:w-[30%] flex flex-col gap-6 overflow-hidden">
          {/* AI Settings Section */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col flex-1 min-h-[300px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold flex items-center gap-2">
                {botConfig?.botMode === "ai" ? (
                  <>
                    <IconCpu size={18} className="text-purple-500" /> AI Settings
                  </>
                ) : (
                  <>
                    <IconBolt size={18} className="text-blue-500" /> Bot Settings
                  </>
                )}
              </h3>
              <div className="flex flex-col items-end gap-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={botConfig?.botMode === "ai"}
                    onChange={toggleBotMode}
                  />
                  <div className={cn(
                    "w-14 h-7 rounded-full peer transition-all after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all",
                    botConfig?.botMode === "ai"
                      ? "bg-purple-500 after:translate-x-7"
                      : "bg-blue-500 after:translate-x-0"
                  )}></div>
                </label>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  botConfig?.botMode === "ai" ? "text-purple-500" : "text-blue-500"
                )}>
                  {botConfig?.botMode === "ai" ? "AI Bot" : "Normal Bot"}
                </span>
              </div>
            </div>

            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {botConfig?.botMode === "ai" ? (
                <>
                  {/* AI Mode Content */}
                  <div className="bg-muted/50 dark:bg-neutral-800 rounded-2xl p-4 border border-border">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Active Model</label>
                    <select
                      value={botConfig?.activeModelId || ""}
                      onChange={(e) => {
                        const modelId = e.target.value;
                        if (modelId) activateModel(modelId);
                      }}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-neutral-900 border-2",
                        !botConfig?.activeModelId
                          ? "border-neutral-300 dark:border-neutral-700 text-neutral-400"
                          : "border-purple-500 text-purple-500"
                      )}
                    >
                      {!botConfig?.activeModelId && (
                        <option value="">Select AI Model</option>
                      )}
                      {aiModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.alias} ({model.modelName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                    {aiModels.map((model) => (
                      <div
                        key={model.id}
                        className={cn(
                          "p-3 rounded-2xl border transition-all group",
                          botConfig?.activeModelId === model.id
                            ? "bg-purple-500/10 border-purple-500/30"
                            : "bg-neutral-50 dark:bg-neutral-800/50 border-transparent hover:border-neutral-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                              botConfig?.activeModelId === model.id ? "bg-purple-500 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                            )}>
                              <IconCpu size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-bold">{model.alias || model.name}</p>
                              <p className="text-[9px] text-neutral-500 flex items-center gap-1">
                                {model.modelName || model.provider}
                                {model.testStatus === "success" && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(model); }}
                              className="p-1.5 hover:bg-blue-500/20 rounded text-neutral-400 hover:text-blue-500 transition-all"
                              title="Edit model"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteModel(model.id); }}
                              className="p-1.5 hover:bg-red-500/20 rounded text-neutral-400 hover:text-red-500 transition-all"
                              title="Delete model"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowAddAiModal(true)}
                    className="w-full py-3 bg-purple-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
                  >
                    <IconPlus size={14} /> Add AI Model
                  </button>
                </>
              ) : (
                <>
                  {/* Normal Mode Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl">
                    <IconBolt size={32} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Normal Bot Mode</p>
                      <p className="text-xs text-muted-foreground mt-1">Use handlers & flows to customize responses</p>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <p>📁 Edit handlers in /handlers</p>
                      <p>🔄 Create flows in /flows</p>
                      <p>⚙️ Configure in config.json</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <IconBook size={18} className="text-neutral-400" /> Knowledge Base
              </h3>
              <span className="text-[10px] font-bold text-neutral-400">{knowledgeBase.length} Files</span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
              {knowledgeBase.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-8">
                  <IconBook size={32} className="mb-2 opacity-50" />
                  <p className="text-xs">No files in /knowledge folder</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Upload text files or create in File Manager</p>
                  <button
                    onClick={() => {
                      setActiveView("files");
                      setCurrentPath("/knowledge");
                    }}
                    className="mt-2 text-[10px] text-green-500 hover:underline"
                  >
                    Open in File Manager →
                  </button>
                </div>
              ) : (
                knowledgeBase.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      // Open in File Manager when clicked
                      setCurrentPath("/knowledge");
                      setActiveView("files");
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                        {getFileIcon(file.filename, false)}
                      </div>
                      <span className="text-[11px] font-bold truncate max-w-[120px]">{file.filename}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKnowledgeFile(i);
                      }}
                      className="text-neutral-300 hover:text-red-500 transition-colors"
                      title="Delete file"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.js,.ts"
              onChange={handleKnowledgeUpload}
              className="hidden"
            />
            <button
              disabled={botConfig?.isEnabled || uploadingFile}
              onClick={() => !botConfig?.isEnabled && fileInputRef.current?.click()}
              className={cn(
                "w-full mt-4 py-2 border-2 border-dashed rounded-xl text-[10px] font-bold transition-all",
                botConfig?.isEnabled || uploadingFile
                  ? "border-neutral-100 dark:border-neutral-800 text-neutral-300 cursor-not-allowed"
                  : "border-neutral-100 dark:border-neutral-800 text-neutral-400 hover:border-green-500 hover:text-green-500 cursor-pointer"
              )}
            >
              {uploadingFile ? "Uploading..." : botConfig?.isEnabled ? "Locked" : "Upload"}
            </button>
            <p className="text-[9px] text-neutral-400 text-center mt-1">TXT, MD, JSON, JS, TS</p>
          </div>
        </div>
      </div>

      {/* New File/Folder Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewModal(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-bold mb-4">
              {showNewModal === "folder" ? "New Folder" : "New File"}
            </h2>
            <input 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={showNewModal === "folder" ? "Folder name" : "filename.txt"}
              className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-green-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setShowNewModal(null)}
                className="flex-1 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={createNewItem}
                className="flex-1 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUnsavedModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <IconAlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Unsaved Changes</h2>
                <p className="text-xs text-muted-foreground">You have unsaved changes in this file</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Do you want to save your changes before leaving?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={saveAndBack}
                className="w-full py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2"
              >
                <IconCheck size={16} /> Save & Leave
              </button>
              <button
                onClick={discardAndBack}
                className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
              >
                <IconX size={16} /> Discard Changes
              </button>
              <button
                onClick={() => setShowUnsavedModal(false)}
                className="w-full py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRenameModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <IconEdit size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Rename File</h2>
                <p className="text-xs text-muted-foreground">Enter new filename</p>
              </div>
            </div>
            <div className="mb-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <p className="text-xs text-neutral-500">Current name</p>
              <p className="text-sm font-medium truncate">{fileToRename?.filename}</p>
            </div>
            <input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameFile()}
              placeholder="New filename"
              className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="flex-1 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={renameFile}
                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <IconTrash size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Delete {fileToDelete?.isDirectory ? "Folder" : "File"}</h2>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-6 p-4 bg-red-500/10 rounded-xl">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Are you sure you want to delete:</p>
              <p className="text-base font-bold text-red-500 mt-1">{fileToDelete?.filename}</p>
              {fileToDelete?.isDirectory && (
                <p className="text-xs text-neutral-500 mt-2">Warning: All contents inside this folder will also be deleted.</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDelete}
                className="w-full py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                <IconTrash size={16} /> Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete AI Model Confirmation Modal */}
      {showDeleteModelModal && modelToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={cancelDeleteModel} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <IconTrash size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Delete AI Model</h2>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-6 p-4 bg-red-500/10 rounded-xl">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Are you sure you want to delete:</p>
              <p className="text-base font-bold text-red-500 mt-1">{modelToDelete.name}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteModel}
                disabled={isDeletingModel}
                className="w-full py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingModel ? <><IconLoader2 size={16} className="animate-spin" /> Deleting...</> : <><IconTrash size={16} /> Delete</>}
              </button>
              <button
                onClick={cancelDeleteModel}
                disabled={isDeletingModel}
                className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTutorialModal(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <IconBook size={24} className="text-green-500" />
                  Bot Studio Guide
                </h2>
                <p className="text-sm text-muted-foreground">Learn how to use Bot Studio</p>
              </div>
              <button onClick={() => setShowTutorialModal(false)} className="text-neutral-400 hover:text-red-500 transition-colors">
                <IconX size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Bot Mode Section */}
              <section>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-sm">1</span>
                  Bot Modes
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="font-bold text-blue-500 mb-1">Normal Bot</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">Rule-based bot using JavaScript handlers and flows</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <p className="font-bold text-purple-500 mb-1">AI Bot</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">AI-powered bot using language models</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  Use the <strong>toggle</strong> in the sidebar to switch between modes.
                </p>
              </section>

              {/* File Manager Section */}
              <section>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-sm">2</span>
                  File Manager
                </h3>
                <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
                  <p><strong>Normal Mode folders:</strong> /handlers, /flows, /prompts</p>
                  <p><strong>AI Mode folders:</strong> /prompts, /knowledge</p>
                  <p>Files are saved separately for each mode.</p>
                  <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 mt-2">
                    <p className="text-xs font-mono">
                      <span className="text-blue-500">📁</span> Click folder to navigate<br/>
                      <span className="text-green-500">📄</span> Click file to edit<br/>
                      <span className="text-amber-500">✏️</span> Hover for rename/delete
                    </p>
                  </div>
                </div>
              </section>

              {/* Testing Section */}
              <section>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-sm">3</span>
                  Testing Your Bot
                </h3>
                <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
                  <p>1. Add AI Model (for AI Mode)</p>
                  <p>2. Create/edit your bot files</p>
                  <p>3. Click <strong>Start</strong> to enable the bot</p>
                  <p>4. Use <strong>Test Chat</strong> to test responses</p>
                </div>
              </section>

              {/* Safety Features */}
              <section>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-sm">⚠️</span>
                  Safety Features
                </h3>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-neutral-600 dark:text-neutral-400">
                  <p>When bot is <strong>running</strong>, file editing and Knowledge Base uploads are <strong>disabled</strong>. Stop the bot first to make changes.</p>
                </div>
              </section>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setShowTutorialModal(false)}
                className="w-full py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all"
              >
                Got it, let's start!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add AI Modal */}
      {showAddAiModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => {
            setShowAddAiModal(false);
            setTestResult(null);
            setTestMessage("");
            setIsEditMode(false);
            setEditingModelId(null);
          }} />
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 rounded-3xl p-8 shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{isEditMode ? "Edit AI Model" : "Add Custom AI Model"}</h2>
                <p className="text-xs text-neutral-500">{isEditMode ? "Update your AI model settings" : "Configure your own AI provider"}</p>
              </div>
              <button onClick={() => {
                setShowAddAiModal(false);
                setTestResult(null);
                setTestMessage("");
                setIsEditMode(false);
                setEditingModelId(null);
              }} className="text-neutral-400 hover:text-red-500 transition-colors">
                <IconX size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Model Alias */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  Model Alias <span className="text-red-500">*</span>
                </label>
                <input
                  value={modelAlias}
                  onChange={(e) => { setModelAlias(e.target.value); setTestResult(null); }}
                  placeholder="E.g., My Support Bot"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-neutral-400 mt-1">Display name for this model</p>
              </div>

              {/* Model Name */}
              <div className="relative">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  Model ID <span className="text-red-500">*</span>
                </label>
                <input
                  value={modelName}
                  onChange={(e) => { handleModelNameChange(e.target.value); setTestResult(null); }}
                  onFocus={() => setShowModelSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowModelSuggestions(false), 200)}
                  placeholder="E.g., gpt-4o, claude-3-5-sonnet, gemini-1.5-pro"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500"
                  autoComplete="off"
                />
                {showModelSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {getPopularModelNames().map((model) => (
                      <button
                        key={model}
                        onMouseDown={() => {
                          handleModelNameChange(model);
                          setShowModelSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">The actual model identifier - pricing auto-fills</p>
              </div>

              {/* API Endpoint */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  API Endpoint <span className="text-red-500">*</span>
                </label>
                <input
                  value={apiEndpoint}
                  onChange={(e) => { setApiEndpoint(e.target.value); setTestResult(null); }}
                  placeholder="E.g., https://api.openai.com/v1/chat/completions"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                />
                <p className="text-[10px] text-neutral-400 mt-1">Full URL to your API endpoint</p>
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  API Key {isEditMode ? <span className="text-neutral-400">(leave empty to keep current)</span> : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                  placeholder={isEditMode ? "Enter new API key to update" : "Your API key"}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              {/* System Prompt (Optional) */}
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">
                  System Prompt <span className="text-neutral-400">(optional)</span>
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={3}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Pricing for Cost Tracking */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1">
                  <IconCpu size={12} /> Token Pricing (USD per 1M tokens)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                      Input Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputPricePer1M}
                      onChange={(e) => setInputPricePer1M(e.target.value)}
                      placeholder="0.50"
                      className="w-full bg-white dark:bg-neutral-900 border-none rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[8px] text-neutral-400 mt-0.5">$/1M input tokens</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                      Output Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={outputPricePer1M}
                      onChange={(e) => setOutputPricePer1M(e.target.value)}
                      placeholder="1.50"
                      className="w-full bg-white dark:bg-neutral-900 border-none rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[8px] text-neutral-400 mt-0.5">$/1M output tokens</p>
                  </div>
                </div>
                <p className="text-[9px] text-amber-500/80 mt-2 flex items-center gap-1">
                  <IconCheck size={10} /> Auto-filled for popular models (GPT, Claude, Gemini, etc.)
                </p>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={cn(
                  "p-4 rounded-xl flex items-start gap-3",
                  testResult === "success"
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                )}>
                  {testResult === "success" ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <IconCheck size={12} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-500">Connection Successful!</p>
                        <p className="text-xs text-green-500/80">{testMessage}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <IconX size={12} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-500">Connection Failed</p>
                        <p className="text-xs text-red-500/80">{testMessage}</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Example Endpoints Guide */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1">
                  <IconBook size={12} /> Example API Endpoints:
                </p>
                <div className="grid grid-cols-1 gap-1 text-[9px] text-neutral-600 dark:text-neutral-400 font-mono">
                  <div className="flex flex-col mb-1 capitalize">
                    <span className="text-blue-500 font-bold mb-0.5">Recommended:</span>
                    <p>• OpenAI: https://api.openai.com/v1/chat/completions</p>
                    <p>• Google AI: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions</p>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-neutral-400 font-bold mb-0.5">Others:</span>
                    <p>• Anthropic: https://api.anthropic.com/v1/messages</p>
                    <p>• Groq: https://api.groq.com/openai/v1/chat/completions</p>
                    <p>• DeepSeek: https://api.deepseek.com/v1/chat/completions</p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={testConnection}
                  disabled={isTesting || !modelAlias || !modelName || !apiEndpoint || !apiKey}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                    isTesting || !modelAlias || !modelName || !apiEndpoint || !apiKey
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  )}
                >
                  {isTesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <IconBolt size={16} /> Test Connection
                    </>
                  )}
                </button>
                <button
                  onClick={isEditMode ? updateModel : handleSaveModel}
                  disabled={savingModel || (!isEditMode && testResult !== "success")}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                    savingModel || (!isEditMode && testResult !== "success")
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-green-500 text-white hover:bg-green-600"
                  )}
                >
                  {savingModel ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isEditMode ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <IconCheck size={16} /> {isEditMode ? "Update Model" : "Save Model"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
