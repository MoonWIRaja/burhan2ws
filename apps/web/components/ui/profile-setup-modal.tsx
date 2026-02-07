"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconUser, IconInfoCircle, IconCheck, IconX } from "@tabler/icons-react";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: (data: { displayName: string; about: string }) => void;
  phoneNumber?: string;
}

export function ProfileSetupModal({ isOpen, onComplete, phoneNumber }: ProfileSetupModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(1);

  const handleSubmit = async () => {
    if (!displayName.trim()) return;
    
    setIsSaving(true);
    try {
      // Save to backend
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: displayName.trim(), about: about.trim() }),
      });
      
      if (res.ok) {
        onComplete({ displayName: displayName.trim(), about: about.trim() });
        // Auto refresh page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "";
    return `+${phone.replace(/\D/g, "")}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-white text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <IconUser size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to Burhan2WS!</h2>
              <p className="text-green-100 text-sm">
                {phoneNumber ? `Connected as ${formatPhone(phoneNumber)}` : "Set up your profile"}
              </p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {step === 1 ? (
                <>
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-foreground mb-2">What's your name?</h3>
                    <p className="text-sm text-muted-foreground">
                      This name will be visible to everyone you message.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <IconUser className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your display name"
                        className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => displayName.trim() && setStep(2)}
                    disabled={!displayName.trim()}
                    className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-muted disabled:text-muted-foreground text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-foreground mb-2">Add a bio (optional)</h3>
                    <p className="text-sm text-muted-foreground">
                      Tell people a little about yourself or your business.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <IconInfoCircle className="absolute left-4 top-4 text-muted-foreground" size={20} />
                      <textarea
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        placeholder="Hey there! I'm using Burhan2WS"
                        rows={3}
                        className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all resize-none"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-2xl transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSaving}
                      className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <IconCheck size={20} />
                          Complete Setup
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Progress dots */}
              <div className="flex justify-center gap-2 pt-4">
                <div className={`w-2 h-2 rounded-full transition-all ${step === 1 ? "bg-green-500 w-6" : "bg-muted"}`} />
                <div className={`w-2 h-2 rounded-full transition-all ${step === 2 ? "bg-green-500 w-6" : "bg-muted"}`} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
