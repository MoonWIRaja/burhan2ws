"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconDotsVertical,
  IconTag,
  IconX,
  IconFileDownload,
  IconUpload,
  IconUser,
  IconPhone,
  IconTrash,
  IconLoader2,
  IconEdit,
  IconRefresh,
  IconInfoCircle
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  tags: { id: string; name: string; color: string }[];
  lastMessageAt: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  contactCount?: number;
}

export default function ContactPage() {
  const { toast, success, error: toastError } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [addMode, setAddMode] = useState<"manual" | "import">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [totalContacts, setTotalContacts] = useState(0);

  // Dropdown menu state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // Filter states
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Pagination & Selection
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importContacts, setImportContacts] = useState<Array<{
    name: string | null;
    phone: string;
    tags: string;
    status: "pending" | "valid" | "invalid";
    error?: string;
    originalIndex: number;
  }>>([]);
  const [validatingNumbers, setValidatingNumbers] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // WhatsApp verification states
  const [checkingNumber, setCheckingNumber] = useState(false);
  const [numberVerified, setNumberVerified] = useState<boolean | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Delete confirmation states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Save/Update confirmation states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Delete tag confirmation states
  const [showDeleteTagModal, setShowDeleteTagModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchQuery,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (tagFilter) {
        params.append("tag", tagFilter);
      }
      const res = await fetch(`/api/contacts?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotalContacts(data.pagination?.total || data.contacts?.length || 0);
      // clear selection on page change or refresh
      setSelectedContacts([]);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page, limit, tagFilter]);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags", {
        credentials: "include",
      });
      const data = await res.json();
      // Ensure we always have an array
      const tagsList = Array.isArray(data.tags) ? data.tags : (Array.isArray(data) ? data : []);
      setTags(tagsList);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      setTags([]);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const debouncedFetch = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          search: searchQuery,
          page: "1",
          limit: limit.toString(),
        });
        if (tagFilter) {
          params.append("tag", tagFilter);
        }
        const res = await fetch(`/api/contacts?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json();
        setContacts(data.contacts || []);
        setTotalContacts(data.pagination?.total || data.contacts?.length || 0);
        setSelectedContacts([]);
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      setPage(1); // Reset to first page when search changes
      debouncedFetch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, limit, tagFilter]); // Re-fetch when search query changes (with debounce)

  useEffect(() => {
    // Ensure session is initialized before fetching data
    const initializeAndFetch = async () => {
      try {
        // Call session endpoint to ensure cookie is set
        await fetch("/api/auth/session", { credentials: "include" });
      } catch (error) {
        console.error("Session init error:", error);
      }
      // Now fetch contacts and tags
      fetchContacts();
      fetchTags();
    };
    initializeAndFetch();
  }, [page, tagFilter, fetchContacts]); // Re-fetch when page or tag filter changes

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page
    fetchContacts();
  };

  const handleTagFilter = (tagId: string | null) => {
    setTagFilter(tagId);
    setPage(1); // Reset to first page when filter changes
    setShowFilterDropdown(false);
  };

  const clearTagFilter = () => {
    setTagFilter(null);
    setPage(1);
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: selectedContacts }),
      });

      if (res.ok) {
        setSelectedContacts([]);
        setShowBulkDeleteModal(false);
        fetchContacts();
        success(`${selectedContacts.length} contacts deleted successfully`);
      } else {
        toastError("Failed to delete contacts");
      }
    } catch (error) {
      console.error("Failed to delete contacts:", error);
      toastError("Failed to delete contacts");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteModal(false);
  };

  const handleSaveContact = async () => {
    if (!newPhone) return;

    // Don't proceed if number is not verified (invalid)
    if (numberVerified === false) {
      return;
    }

    // Show confirmation modal
    setShowSaveModal(true);
  };

  const confirmSaveContact = async () => {
    try {
      setIsSavingContact(true);
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName || null,
          phoneNumber: newPhone,
          tagIds: selectedTags,
        }),
      });

      if (res.ok) {
        setShowSaveModal(false);
        setShowAddModal(false);
        setNewName("");
        setNewPhone("");
        setSelectedTags([]);
        setNumberVerified(null);
        setVerificationError(null);
        fetchContacts();
        success("Contact added successfully");
      } else {
        setShowSaveModal(false);
        const data = await res.json();
        if (data.code === "NOT_ON_WHATSAPP") {
          setVerificationError(data.error);
          setNumberVerified(false);
        } else {
          toastError("Failed to save contact");
        }
      }
    } catch (error) {
      console.error("Failed to save contact:", error);
      setShowSaveModal(false);
      toastError("Failed to save contact");
    } finally {
      setIsSavingContact(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    setNewPhone(value);
    setNumberVerified(null);
    setVerificationError(null);
  };

  // Debounced verification effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newPhone.trim().length >= 8 && newPhone.startsWith("+")) {
        checkPhoneNumber(newPhone);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [newPhone]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewName("");
    setNewPhone("");
    setSelectedTags([]);
    setNumberVerified(null);
    setVerificationError(null);
  };

  const handleDownloadTemplate = () => {
    window.location.href = "/api/contacts/template";
  };

  // Parse CSV file
  const parseCSV = (file: File): Promise<Array<{ name: string | null; phone: string; tags: string }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").filter(line => line.trim());

          // Find header line (starts with "name" or "phone_number")
          let headerIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes("name") || lines[i].toLowerCase().includes("phone")) {
              headerIndex = i;
              break;
            }
          }

          const contacts: Array<{ name: string | null; phone: string; tags: string }> = [];

          for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("Note:") || line.startsWith("-")) continue;

            // Handle CSV parsing with quotes
            const values: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === "," && !inQuotes) {
                values.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            values.push(current.trim());

            const name = values[0] || null;
            const phone = values[1] || "";
            const tags = values[2] || "";

            if (phone) {
              contacts.push({ name, phone: phone.replace(/\s/g, ""), tags });
            }
          }

          resolve(contacts);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  // Check WhatsApp status for all numbers
  const checkAllNumbers = async (
    contacts: Array<{ name: string | null; phone: string; tags: string; originalIndex: number }>
  ): Promise<Array<{ name: string | null; phone: string; tags: string; status: "valid" | "invalid"; error?: string; originalIndex: number }>> => {
    const results = await Promise.all(
      contacts.map(async (contact) => {
        // Skip empty phone numbers
        if (!contact.phone || contact.phone.trim().length < 8) {
          return {
            ...contact,
            status: "invalid" as const,
            error: "Invalid phone number"
          };
        }

        try {
          const res = await fetch("/api/contacts/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ phoneNumber: contact.phone }),
          });

          const data = await res.json();

          if (res.ok && data.isOnWhatsApp) {
            return { ...contact, status: "valid" as const, error: undefined };
          } else if (res.ok) {
            return {
              ...contact,
              status: "invalid" as const,
              error: "Not on WhatsApp"
            };
          } else {
            // Handle WhatsApp not connected error
            const errorMsg = data.error || "Check failed";
            return {
              ...contact,
              status: "invalid" as const,
              error: errorMsg.includes("WhatsApp not connected") ? "WhatsApp not connected" : errorMsg
            };
          }
        } catch (error) {
          return {
            ...contact,
            status: "invalid" as const,
            error: "Check failed"
          };
        }
      })
    );

    return results;
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      setValidatingNumbers(true);

      // Check WhatsApp connection first
      try {
        const statusRes = await fetch("/api/auth/status", { credentials: "include" });
        const statusData = await statusRes.json();
        if (!statusData.connected) {
          toastError("WhatsApp is not connected! Please connect your WhatsApp account in Settings first before importing contacts.");
          setValidatingNumbers(false);
          return;
        }
      } catch (statusError) {
        console.error("Status check failed:", statusError);
        // Continue anyway - backend will handle the error
      }

      // Parse CSV
      const parsedContacts = await parseCSV(importFile);

      if (parsedContacts.length === 0) {
        toastError("No valid contacts found in CSV. Please check the file format.");
        setValidatingNumbers(false);
        return;
      }

      // Set initial state with pending status and originalIndex
      const initialContacts = parsedContacts.map((c, i) => ({
        ...c,
        status: "pending" as const,
        originalIndex: i,
      }));
      setImportContacts(initialContacts);
      setShowImportModal(true);

      // Check all numbers - passing initialContacts which already has originalIndex
      const checkedContacts = await checkAllNumbers(initialContacts);

      setImportContacts(checkedContacts);
      setValidatingNumbers(false);
    } catch (error) {
      console.error("Import error:", error);
      toastError("Failed to parse CSV file. Please check the format.");
      setValidatingNumbers(false);
    }
  };

  // Update import contact phone number
  const updateImportContactPhone = (index: number, newPhone: string) => {
    setImportContacts(importContacts.map((c, i) =>
      i === index ? { ...c, phone: newPhone.replace(/\s/g, ""), status: "pending" as const, error: undefined } : c
    ));
  };

  // Remove import contact
  const removeImportContact = (index: number) => {
    setImportContacts(importContacts.filter((_, i) => i !== index));
  };

  // Re-check specific contact
  const recheckContact = async (index: number) => {
    const contact = importContacts[index];

    // Validate phone number before checking
    if (!contact.phone || contact.phone.trim().length < 8) {
      setImportContacts(importContacts.map((c, i) =>
        i === index ? { ...c, status: "invalid" as const, error: "Invalid phone number" } : c
      ));
      return;
    }

    try {
      const res = await fetch("/api/contacts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: contact.phone }),
      });

      const data = await res.json();

      if (res.ok && data.isOnWhatsApp) {
        setImportContacts(importContacts.map((c, i) =>
          i === index ? { ...c, status: "valid" as const, error: undefined } : c
        ));
      } else if (res.ok) {
        setImportContacts(importContacts.map((c, i) =>
          i === index ? { ...c, status: "invalid" as const, error: "Not on WhatsApp" } : c
        ));
      } else {
        setImportContacts(importContacts.map((c, i) =>
          i === index ? { ...c, status: "invalid" as const, error: data.error || "Check failed" } : c
        ));
      }
    } catch (error) {
      setImportContacts(importContacts.map((c, i) =>
        i === index ? { ...c, status: "invalid" as const, error: "Check failed" } : c
      ));
    }
  };

  // Re-check all pending/invalid contacts
  const recheckAllContacts = async () => {
    setValidatingNumbers(true);
    const pendingOrInvalid = importContacts.filter(c => c.status !== "valid");

    if (pendingOrInvalid.length === 0) {
      setValidatingNumbers(false);
      return;
    }

    const checked = await checkAllNumbers(pendingOrInvalid);

    // Create a map for faster lookup using originalIndex
    const checkedMap = new Map(checked.map(c => [c.originalIndex, c]));

    setImportContacts(importContacts.map(c => {
      const updated = checkedMap.get(c.originalIndex);
      if (updated) {
        return updated;
      }
      return c;
    }));
    setValidatingNumbers(false);
  };

  // Confirm import
  const confirmImport = async () => {
    const validContacts = importContacts.filter(c => c.status === "valid");

    if (validContacts.length === 0) {
      toastError("No valid contacts to import. Please correct the phone numbers.");
      return;
    }

    try {
      setImporting(true);

      // Create CSV with only valid contacts
      const csvContent = [
        "name,phone_number,tags",
        ...validContacts.map(c =>
          `"${c.name || ""}","${c.phone}","${c.tags}"`
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", new File([blob], "contacts.csv", { type: "text/csv" }));

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setShowImportModal(false);
        setImportContacts([]);
        setImportFile(null);
        fetchContacts();
        setShowAddModal(false);
        success(`Successfully imported ${data.imported} contacts!`);
      } else {
        toastError("Import failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Import error:", error);
      toastError("Failed to import contacts");
    } finally {
      setImporting(false);
    }
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const handleAddTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      setSelectedTags([...selectedTags, tagId]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  };

  const handleCreateTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: tagName.trim(), color: "green" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Add the new tag to selected tags
        if (data.id) {
          setSelectedTags([...selectedTags, data.id]);
        }
        // Refresh tags list
        fetchTags();
        setTagInput("");
        setShowTagDropdown(false);
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const handleDeleteTag = (tagId: string, tagName: string) => {
    // Find the tag and show confirmation modal
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      setTagToDelete(tag);
      setShowDeleteTagModal(true);
      setShowTagDropdown(false);
    }
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      setIsDeletingTag(true);
      const res = await fetch(`/api/tags/${tagToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setShowDeleteTagModal(false);
        setTagToDelete(null);
        // Refresh tags list
        fetchTags();
        // Remove from selected tags if present
        setSelectedTags(selectedTags.filter(t => t !== tagToDelete.id));
        success("Tag deleted successfully");
      } else {
        const data = await res.json();
        toastError(data.error || data.message || "Failed to delete tag");
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
      toastError("Failed to delete tag");
    } finally {
      setIsDeletingTag(false);
    }
  };

  const cancelDeleteTag = () => {
    setShowDeleteTagModal(false);
    setTagToDelete(null);
  };

  const checkPhoneNumber = async (phoneNumber: string) => {
    // Reset verification states
    setNumberVerified(null);
    setVerificationError(null);

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return;
    }

    try {
      setCheckingNumber(true);
      const res = await fetch("/api/contacts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber }),
      });

      // Check if response is OK before parsing JSON
      if (!res.ok) {
        // Try to parse error, but handle empty response
        let errorMsg = "Failed to verify number";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response body is empty or not JSON
        }
        setVerificationError(errorMsg);
        setNumberVerified(false);
        return;
      }

      // Parse successful response
      const data = await res.json();

      if (data.isOnWhatsApp) {
        setNumberVerified(true);
      } else {
        setNumberVerified(false);
        setVerificationError("The phone number entered is not registered with WhatsApp");
      }
    } catch (error) {
      console.error("Failed to check number:", error);
      setVerificationError("Failed to verify number. Please try again.");
      setNumberVerified(false);
    } finally {
      setCheckingNumber(false);
    }
  };

  // Close filter dropdown when clicking outside (contact dropdown uses Portal overlay)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close filter dropdown only
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open edit modal with contact data
  const handleEditClick = (contact: Contact) => {
    console.log("[Edit] Contact tags:", contact.tags);
    console.log("[Edit] Contact tag IDs:", contact.tags?.map((t: any) => t.id));
    setEditingContact(contact);
    setNewName(contact.name || "");
    setNewPhone(contact.phoneNumber);
    setSelectedTags(contact.tags?.map((t: any) => t.tag?.id || t.id) || []);
    setShowEditModal(true);
    setActiveDropdown(null);
    setDropdownPosition(null);
  };

  // Open dropdown with position
  const handleDropdownClick = (e: React.MouseEvent, contactId: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      top: rect.bottom + 4,
      left: rect.right - 140, // Align to right side, 140px is dropdown width
    };
    setDropdownPosition(position);

    if (activeDropdown === contactId) {
      setActiveDropdown(null);
      setDropdownPosition(null);
    } else {
      setActiveDropdown(contactId);
    }
  };

  // Update contact
  const handleUpdateContact = async () => {
    if (!editingContact || !newPhone) return;
    // Show confirmation modal
    setShowUpdateModal(true);
  };

  const confirmUpdateContact = async () => {
    if (!editingContact || !newPhone) return;

    try {
      setIsSavingContact(true);
      const res = await fetch(`/api/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName || null,
          phoneNumber: newPhone,
          tagIds: selectedTags,
        }),
      });

      if (res.ok) {
        setShowUpdateModal(false);
        setShowEditModal(false);
        setEditingContact(null);
        setNewName("");
        setNewPhone("");
        setSelectedTags([]);
        fetchContacts();
        success("Contact updated successfully");
      } else {
        setShowUpdateModal(false);
        toastError("Failed to update contact");
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
      setShowUpdateModal(false);
      toastError("Failed to update contact");
    } finally {
      setIsSavingContact(false);
    }
  };

  // Delete single contact
  const handleDeleteContact = async (contactId: string) => {
    // Find the contact and show confirmation modal
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      setContactToDelete(contact);
      setShowDeleteModal(true);
      setActiveDropdown(null);
      setDropdownPosition(null);
    }
  };

  // Confirm delete contact
  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/contacts/${contactToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setShowDeleteModal(false);
        setContactToDelete(null);
        fetchContacts();
        success("Contact deleted successfully");
      } else {
        toastError("Failed to delete contact");
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toastError("Failed to delete contact");
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  };

  const filteredTags = (tags || []).filter(t =>
    t?.name?.toLowerCase().includes(tagInput.toLowerCase())
  );

  // Check if current input matches an existing tag exactly
  const hasExactMatch = filteredTags.some(t =>
    t?.name?.toLowerCase() === tagInput.toLowerCase().trim()
  );

  // Show create option when there's input and no exact match
  const showCreateOption = tagInput.trim().length > 0 && !hasExactMatch;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Contacts</h1>
          <p className="text-muted-foreground">Manage your WhatsApp contacts and leads.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-2xl text-sm font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95"
          >
            <IconPlus size={18} /> Add Contact
          </button>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          {selectedContacts.length > 0 ? (
            <div className="flex items-center gap-4 w-full">
              <span className="text-sm font-bold text-foreground">{selectedContacts.length} selected</span>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isBulkDeleting ? <IconLoader2 size={16} className="animate-spin" /> : <IconTrash size={16} />}
                Delete Selected
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSearch} className="relative flex-1 min-w-[300px]">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border-none rounded-xl text-sm pl-10 pr-4 py-2.5 focus:ring-1 focus:ring-green-500"
                  placeholder="Search by name or number..."
                />
              </form>
              <div className="flex gap-2 items-center">
                {/* Tag Filter Dropdown */}
                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={cn(
                      "p-2.5 bg-background rounded-xl transition-colors flex items-center gap-1.5",
                      tagFilter ? "text-green-500" : "text-muted-foreground hover:text-green-500"
                    )}
                  >
                    <IconTag size={18} />
                    {tagFilter && (
                      <span className="text-xs font-bold">
                        {tags.find(t => t.id === tagFilter)?.name || "Filtered"}
                      </span>
                    )}
                  </button>

                  {showFilterDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-border overflow-hidden min-w-[200px]">
                      {/* Clear filter option */}
                      {tagFilter && (
                        <button
                          onClick={clearTagFilter}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors border-b border-border"
                        >
                          <IconX size={14} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Clear Filter</span>
                        </button>
                      )}

                      {/* All Contacts */}
                      <button
                        onClick={() => handleTagFilter(null)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                          !tagFilter && "bg-muted/50"
                        )}
                      >
                        <IconUser size={14} className="text-muted-foreground" />
                        <span>All Contacts</span>
                        <span className="ml-auto text-xs text-muted-foreground">{totalContacts}</span>
                      </button>

                      {/* Tag options */}
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => handleTagFilter(tag.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                            tagFilter === tag.id && "bg-green-50 dark:bg-green-900/20"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            tagFilter === tag.id ? "bg-green-500" : "bg-muted-foreground"
                          )} />
                          <span className={tagFilter === tag.id ? "text-green-600 dark:text-green-400 font-medium" : ""}>{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-4 w-12">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContacts(contacts.map(c => c.id));
                        } else {
                          setSelectedContacts([]);
                        }
                      }}
                    />
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Message</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No contacts yet. Add your first contact!
                    </td>
                  </tr>
                ) : (
                  contacts.map((c, index) => (
                    <tr
                      key={c.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        index === contacts.length - 1 && "border-b border-border"
                      )}
                    >
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          checked={selectedContacts.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContacts([...selectedContacts, c.id]);
                            } else {
                              setSelectedContacts(selectedContacts.filter(id => id !== c.id));
                            }
                          }}
                        />
                      </td>
                      <td className="p-4 font-bold text-sm text-foreground">{c.name || "Unknown"}</td>
                      <td className="p-4 text-sm text-muted-foreground">{c.phoneNumber}</td>
                      <td className="p-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {c.tags?.map((t) => (
                            <span key={t.id} className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight shadow-sm",
                              "bg-green-50 text-green-600 border border-green-100"
                            )}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatTimeAgo(c.lastMessageAt)}</td>
                      <td className="p-4 relative">
                        <div className="relative">
                          <button
                            onClick={(e) => handleDropdownClick(e, c.id)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors"
                          >
                            <IconDotsVertical size={16} className="text-muted-foreground hover:text-foreground" />
                          </button>

                          {/* Dropdown Menu - Using Portal */}
                          {activeDropdown === c.id && dropdownPosition && createPortal(
                            <>
                              <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => {
                                  setActiveDropdown(null);
                                  setDropdownPosition(null);
                                }}
                              />
                              <div
                                className="fixed z-[101] bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-border overflow-hidden min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
                                style={{
                                  top: `${dropdownPosition.top}px`,
                                  left: `${dropdownPosition.left}px`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleEditClick(c)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                                >
                                  <IconEdit size={14} className="text-blue-500" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteContact(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors text-red-500"
                                >
                                  <IconTrash size={14} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-bold uppercase tracking-widest shrink-0">
          <span>Showing {contacts.length} of {totalContacts} contacts</span>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 bg-muted rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              Prev
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={contacts.length < limit || loading}
              className="px-3 py-1.5 bg-muted rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Add New Contact</h2>
                <p className="text-xs text-muted-foreground mt-1">Choose how you want to add contacts.</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 text-neutral-400 hover:text-red-500 transition-colors">
                <IconX size={24} />
              </button>
            </div>

            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 m-6 rounded-2xl">
              <button 
                onClick={() => setAddMode("manual")}
                className={cn(
                  "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                  addMode === "manual" ? "bg-card text-green-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Manual Entry
              </button>
              <button 
                onClick={() => setAddMode("import")}
                className={cn(
                  "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                  addMode === "import" ? "bg-card text-green-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Import via CSV
              </button>
            </div>

            <div className="px-6 pb-8">
              {addMode === "manual" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Full Name</label>
                      <div className="relative">
                        <IconUser size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="E.g. John Doe"
                          className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Phone Number</label>
                      <div className="relative">
                        <IconPhone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          value={newPhone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          placeholder="+60123456789"
                          className={cn(
                            "w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-10 pr-10 py-3 text-sm focus:ring-1 focus:ring-green-500",
                            numberVerified === false && "ring-2 ring-red-500"
                          )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {checkingNumber && (
                            <div className="group relative">
                              <IconLoader2 size={18} className="animate-spin text-yellow-500" />
                              <div className="absolute right-0 top-full mt-1 w-40 bg-neutral-800 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Checking WhatsApp number...
                              </div>
                            </div>
                          )}
                          {numberVerified === true && (
                            <div className="group relative">
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="absolute right-0 top-full mt-1 w-36 bg-neutral-800 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Number is on WhatsApp
                              </div>
                            </div>
                          )}
                          {numberVerified === false && (
                            <div className="group relative">
                              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center cursor-help">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                              <div className="absolute right-0 top-full mt-1 w-48 bg-neutral-800 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {verificationError || "Number not on WhatsApp"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1 ml-1 flex items-center gap-1">
                        <span className="font-bold">IMPORTANT:</span> Include country code (e.g. +60 for Malaysia)
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Tags</label>
                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-2 border border-neutral-100 dark:border-neutral-700 min-h-[52px]">
                      <div className="flex flex-wrap gap-2 items-center">
                        {selectedTags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                              {tag.name}
                              <button 
                                onClick={() => setSelectedTags(selectedTags.filter(t => t !== tagId))}
                                className="w-5 h-5 rounded-lg flex items-center justify-center hover:bg-green-500/20 text-green-500 transition-colors"
                              >
                                <IconX size={12} />
                              </button>
                            </span>
                          ) : null;
                        })}
                        <input 
                          type="text"
                          value={tagInput}
                          onFocus={() => setShowTagDropdown(true)}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder={selectedTags.length === 0 ? "Select tags..." : ""}
                          className="flex-1 min-w-[120px] bg-transparent border-none focus:ring-0 text-sm py-1 placeholder:text-neutral-400"
                        />
                      </div>
                    </div>

                    {showTagDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50">
                        <div className="fixed inset-0 z-0" onClick={() => setShowTagDropdown(false)} />
                        <div className="relative mt-2 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 shadow-2xl overflow-hidden">
                          <div className="max-h-[200px] overflow-y-auto py-2">
                            {/* Available tags (with contacts) */}
                            {filteredTags.filter(t => (t.contactCount || 0) > 0).length > 0 && (
                              <>
                                {filteredTags.filter(t => (t.contactCount || 0) > 0).map(tag => (
                                  <div
                                    key={tag.id}
                                    onClick={() => handleAddTag(tag.id)}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer"
                                  >
                                    <span className="text-sm font-medium">{tag.name}</span>
                                    <span className="text-xs text-neutral-400">{tag.contactCount || 0}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {/* Unused tags (without contacts) - with delete option */}
                            {filteredTags.filter(t => (t.contactCount || 0) === 0).length > 0 && (
                              <>
                                {(filteredTags.filter(t => (t.contactCount || 0) > 0).length > 0 || showCreateOption) && (
                                  <div className="border-t border-neutral-100 dark:border-neutral-700 my-1" />
                                )}
                                {filteredTags.filter(t => (t.contactCount || 0) === 0).map(tag => (
                                  <div
                                    key={tag.id}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                                  >
                                    <span
                                      onClick={() => handleAddTag(tag.id)}
                                      className="text-sm font-medium text-neutral-400 flex-1 cursor-pointer"
                                    >
                                      {tag.name}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTag(tag.id, tag.name);
                                      }}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-500 transition-colors"
                                      title="Delete unused tag"
                                    >
                                      <IconTrash size={14} />
                                    </button>
                                  </div>
                                ))}
                              </>
                            )}
                            {showCreateOption && (
                              <div
                                onClick={() => handleCreateTag(tagInput)}
                                className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer border-t border-neutral-100 dark:border-neutral-700"
                              >
                                <IconPlus size={16} className="text-green-500" />
                                <span className="text-sm font-medium text-green-500">
                                  Create "{tagInput.trim()}"
                                </span>
                              </div>
                            )}
                            {filteredTags.length === 0 && !showCreateOption && (
                              <div className="px-4 py-3 text-sm text-neutral-400 text-center">
                                No tags found. Type to create a new one.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveContact}
                    disabled={!newPhone || isSavingContact || numberVerified === false || checkingNumber}
                    className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all mt-4 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSavingContact ? "Saving..." : checkingNumber ? "Checking Number..." : "Save Contact"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-5 border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <IconFileDownload size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">1. Download Template</p>
                        <p className="text-xs text-neutral-500">Get the required CSV structure first.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleDownloadTemplate}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                      Download
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                      "p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 transition-colors",
                      importFile 
                        ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" 
                        : "border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}>
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        importFile ? "bg-green-500 text-white" : "bg-green-500/10 text-green-500"
                      )}>
                        {importFile ? <IconUpload size={32} /> : <IconUpload size={32} />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold">
                          {importFile ? importFile.name : "2. Upload Filled Template"}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {importFile ? "Click to change file" : "Drag and drop or click to browse"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleImport}
                    disabled={!importFile || importing}
                    className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <IconLoader2 size={18} className="animate-spin" /> Importing...
                      </>
                    ) : (
                      "Start Importing"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => {
            setShowEditModal(false);
            setEditingContact(null);
            setNewName("");
            setNewPhone("");
            setSelectedTags([]);
          }} />
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Edit Contact</h2>
                <p className="text-xs text-muted-foreground mt-1">Update contact information.</p>
              </div>
              <button onClick={() => {
                setShowEditModal(false);
                setEditingContact(null);
                setNewName("");
                setNewPhone("");
                setSelectedTags([]);
              }} className="p-2 text-neutral-400 hover:text-red-500 transition-colors">
                <IconX size={24} />
              </button>
            </div>

            <div className="px-6 pb-8">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Full Name</label>
                    <div className="relative">
                      <IconUser size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="E.g. John Doe"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Phone Number</label>
                    <div className="relative">
                      <IconPhone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+60123456789"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5 ml-1">Tags</label>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-2 border border-neutral-100 dark:border-neutral-700 min-h-[52px]">
                    <div className="flex flex-wrap gap-2 items-center">
                      {selectedTags.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag ? (
                          <span key={tagId} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                            {tag.name}
                            <button
                              onClick={() => setSelectedTags(selectedTags.filter(t => t !== tagId))}
                              className="w-5 h-5 rounded-lg flex items-center justify-center hover:bg-green-500/20 text-green-500 transition-colors"
                            >
                              <IconX size={12} />
                            </button>
                          </span>
                        ) : null;
                      })}
                      <input
                        type="text"
                        value={tagInput}
                        onFocus={() => setShowTagDropdown(true)}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder={selectedTags.length === 0 ? "Select tags..." : ""}
                        className="flex-1 min-w-[120px] bg-transparent border-none focus:ring-0 text-sm py-1 placeholder:text-neutral-400"
                      />
                    </div>
                  </div>

                  {showTagDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50">
                      <div className="fixed inset-0 z-0" onClick={() => setShowTagDropdown(false)} />
                      <div className="relative mt-2 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 shadow-2xl overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto py-2">
                          {/* Available tags (with contacts) */}
                          {filteredTags.filter(t => (t.contactCount || 0) > 0).length > 0 && (
                            <>
                              {filteredTags.filter(t => (t.contactCount || 0) > 0).map(tag => (
                                <div
                                  key={tag.id}
                                  onClick={() => {
                                    if (!selectedTags.includes(tag.id)) {
                                      setSelectedTags([...selectedTags, tag.id]);
                                    }
                                    setTagInput("");
                                    setShowTagDropdown(false);
                                  }}
                                  className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer"
                                >
                                  <span className="text-sm font-medium">{tag.name}</span>
                                  <span className="text-xs text-neutral-400">{tag.contactCount || 0}</span>
                                </div>
                              ))}
                            </>
                          )}
                          {/* Unused tags (without contacts) - with delete option */}
                          {filteredTags.filter(t => (t.contactCount || 0) === 0).length > 0 && (
                            <>
                              {(filteredTags.filter(t => (t.contactCount || 0) > 0).length > 0 || showCreateOption) && (
                                <div className="border-t border-neutral-100 dark:border-neutral-700 my-1" />
                              )}
                              {filteredTags.filter(t => (t.contactCount || 0) === 0).map(tag => (
                                <div
                                  key={tag.id}
                                  className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                                >
                                  <span
                                    onClick={() => {
                                      if (!selectedTags.includes(tag.id)) {
                                        setSelectedTags([...selectedTags, tag.id]);
                                      }
                                      setTagInput("");
                                      setShowTagDropdown(false);
                                    }}
                                    className="text-sm font-medium text-neutral-400 flex-1 cursor-pointer"
                                  >
                                    {tag.name}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTag(tag.id, tag.name);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-500 transition-colors"
                                    title="Delete unused tag"
                                  >
                                    <IconTrash size={14} />
                                  </button>
                                </div>
                              ))}
                            </>
                          )}
                          {showCreateOption && (
                            <div
                              onClick={() => handleCreateTag(tagInput)}
                              className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer border-t border-neutral-100 dark:border-neutral-700"
                            >
                              <IconPlus size={16} className="text-green-500" />
                              <span className="text-sm font-medium text-green-500">
                                Create "{tagInput.trim()}"
                              </span>
                            </div>
                          )}
                          {filteredTags.length === 0 && !showCreateOption && (
                            <div className="px-4 py-3 text-sm text-neutral-400 text-center">
                              No tags found. Type to create a new one.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingContact(null);
                      setNewName("");
                      setNewPhone("");
                      setSelectedTags([]);
                    }}
                    className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateContact}
                    disabled={!newPhone || isSavingContact}
                    className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingContact ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && contactToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelDelete} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-red-100 dark:border-red-900/50">
            <div className="p-6 text-center">
              {/* Warning Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <IconTrash size={28} className="text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Delete Contact?</h3>

              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete <span className="font-bold text-foreground">{contactToDelete.name || contactToDelete.phoneNumber}</span>?
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 mb-6">
                This action cannot be undone.
              </p>

              {/* Contact Info */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0">
                    {(contactToDelete.name || contactToDelete.phoneNumber)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-foreground truncate">{contactToDelete.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground truncate mb-2">{contactToDelete.phoneNumber}</p>
                    {contactToDelete.tags && contactToDelete.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-center">
                        {contactToDelete.tags.map((t) => (
                          <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteContact}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Deleting...
                    </>
                  ) : (
                    <>
                      <IconTrash size={16} /> Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelBulkDelete} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-red-100 dark:border-red-900/50">
            <div className="p-6 text-center">
              {/* Warning Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <IconTrash size={28} className="text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Delete {selectedContacts.length} Contacts?</h3>

              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete <span className="font-bold text-foreground">{selectedContacts.length} selected contacts</span>?
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 mb-6">
                This action cannot be undone.
              </p>

              {/* Info Box */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <IconTrash size={16} className="text-red-500" />
                  </div>
                  <span>{selectedContacts.length} contacts will be permanently removed</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkDeleting ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Deleting...
                    </>
                  ) : (
                    <>
                      <IconTrash size={16} /> Delete All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Contact Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSaveModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-green-100 dark:border-green-900/50">
            <div className="p-6 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <IconPlus size={28} className="text-green-500" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Add New Contact?</h3>

              <p className="text-sm text-muted-foreground mb-6">
                Add <span className="font-bold text-foreground">{newName || "this contact"}</span> to your contacts?
              </p>

              {/* Contact Preview */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0">
                    {(newName || newPhone)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-foreground truncate">{newName || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground truncate mb-2">{newPhone}</p>
                    {selectedTags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-center">
                        {selectedTags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSavingContact}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveContact}
                  disabled={isSavingContact}
                  className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingContact ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <IconPlus size={16} /> Add Contact
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Contact Confirmation Modal */}
      {showUpdateModal && editingContact && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpdateModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-blue-100 dark:border-blue-900/50">
            <div className="p-6 text-center">
              {/* Edit Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <IconEdit size={28} className="text-blue-500" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Update Contact?</h3>

              <p className="text-sm text-muted-foreground mb-6">
                Save changes to <span className="font-bold text-foreground">{newName || editingContact.name || "this contact"}</span>?
              </p>

              {/* Contact Preview */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0">
                    {(newName || newPhone)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-foreground truncate">{newName || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground truncate mb-2">{newPhone}</p>
                    {selectedTags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-center">
                        {selectedTags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isSavingContact}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpdateContact}
                  disabled={isSavingContact}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingContact ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <IconEdit size={16} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tag Confirmation Modal */}
      {showDeleteTagModal && tagToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelDeleteTag} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-orange-100 dark:border-orange-900/50">
            <div className="p-6 text-center">
              {/* Warning Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <IconTag size={28} className="text-orange-500" />
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Delete Tag?</h3>

              <p className="text-sm text-muted-foreground mb-6">
                Delete the tag <span className="font-bold text-foreground text-orange-500">"{tagToDelete.name}"</span>?
              </p>

              {/* Tag Preview */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 mb-6 flex items-center justify-center">
                <span className="px-3 py-1 rounded-full text-sm font-bold uppercase tracking-tight bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                  {tagToDelete.name}
                </span>
              </div>

              {/* Info */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
                <IconInfoCircle size={16} className="text-orange-500" />
                <span>This tag is not used by any contacts</span>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteTag}
                  disabled={isDeletingTag}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteTag}
                  disabled={isDeletingTag}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingTag ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Deleting...
                    </>
                  ) : (
                    <>
                      <IconTrash size={16} /> Delete Tag
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 border border-neutral-200 dark:border-neutral-800">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Import Contacts</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {importContacts.filter(c => c.status === "valid").length} valid, {importContacts.filter(c => c.status === "invalid").length} invalid
                  </p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="p-2 text-neutral-400 hover:text-red-500 transition-colors">
                  <IconX size={20} />
                </button>
              </div>

              {/* Info Banner */}
              {importContacts.filter(c => c.status === "invalid").length > 0 && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold">
                    <IconInfoCircle size={16} />
                    <span>Please correct or remove invalid contacts before importing</span>
                  </div>
                </div>
              )}

              {/* Contacts List */}
              <div className="max-h-[300px] overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-2xl mb-4">
                {importContacts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {validatingNumbers ? (
                      <div className="flex flex-col items-center gap-3">
                        <IconLoader2 size={24} className="animate-spin text-green-500" />
                        <p className="text-sm">Checking phone numbers...</p>
                      </div>
                    ) : (
                      <p className="text-sm">No contacts found</p>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                        <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Phone</th>
                        <th className="px-3 py-2 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Tags</th>
                        <th className="px-3 py-2 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {importContacts.map((contact, index) => (
                        <tr key={contact.originalIndex} className={contact.status === "invalid" ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={contact.name || ""}
                              onChange={(e) => {
                                const updated = [...importContacts];
                                updated[index].name = e.target.value || null;
                                setImportContacts(updated);
                              }}
                              className="w-full bg-transparent border-none text-sm focus:ring-0 text-foreground"
                              placeholder="No name"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={contact.phone}
                                onChange={(e) => updateImportContactPhone(index, e.target.value)}
                                className={cn(
                                  "flex-1 bg-transparent border-b border-transparent text-sm focus:ring-0 focus:border-green-500 text-foreground",
                                  contact.status === "invalid" && "text-red-500"
                                )}
                              />
                              {contact.status === "valid" && (
                                <span className="text-green-500">✓</span>
                              )}
                            </div>
                            {contact.error && (
                              <p className="text-[10px] text-red-500 mt-1">{contact.error}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={contact.tags}
                              onChange={(e) => {
                                const updated = [...importContacts];
                                updated[index].tags = e.target.value;
                                setImportContacts(updated);
                              }}
                              className="w-full bg-transparent border-none text-sm focus:ring-0 text-muted-foreground"
                              placeholder="No tags"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {contact.status === "pending" && validatingNumbers && (
                              <IconLoader2 size={16} className="animate-spin text-yellow-500 mx-auto" />
                            )}
                            {contact.status === "valid" && (
                              <span className="inline-flex items-center gap-1 text-green-500 text-xs font-bold">
                                ✓ Valid
                              </span>
                            )}
                            {contact.status === "invalid" && (
                              <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold">
                                ✗ Invalid
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {contact.status !== "valid" && (
                                <button
                                  onClick={() => recheckContact(index)}
                                  disabled={validatingNumbers}
                                  className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="Re-check"
                                >
                                  <IconRefresh size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => removeImportContact(index)}
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex gap-2">
                  <button
                    onClick={recheckAllContacts}
                    disabled={validatingNumbers || importing}
                    className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-sm font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                  >
                    <IconRefresh size={16} className={validatingNumbers ? "animate-spin" : ""} />
                    Re-check All
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportContacts([]);
                      setImportFile(null);
                    }}
                    disabled={importing}
                    className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-sm font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                  >
                    <IconX size={16} /> Cancel
                  </button>
                </div>
                <button
                  onClick={confirmImport}
                  disabled={importContacts.filter(c => c.status === "valid").length === 0 || importing || validatingNumbers}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <IconLoader2 size={16} className="animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <IconUpload size={16} /> Import {importContacts.filter(c => c.status === "valid").length} Contacts
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
