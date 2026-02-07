"use client";
import React, { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconArrowLeft,
  IconBrandTabler,
  IconSettings,
  IconUserCircle,
  IconSpeakerphone,
  IconMessageChatbot,
  IconUsers,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconLogout,
  IconUser,
  IconX,
  IconLoader2,
} from "@tabler/icons-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ProfileSetupModal } from "@/components/ui/profile-setup-modal";

interface SessionData {
  phoneNumber: string | null;
  displayName: string | null;
  status: string;
  profilePicUrl: string | null;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    // Clear session cookies
    document.cookie = "session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    document.cookie = "wa_connected=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    setShowProfileDrawer(false);
    // Use window.location for full page reload to ensure clean state
    window.location.href = "/login";
  };

  // Fetch session data
  useEffect(() => {
    if (!isLoginPage) {
      fetchSession();
    }
  }, [isLoginPage]);

  const fetchSession = async () => {
    try {
      setLoadingSession(true);
      const res = await fetch("/api/auth/status", {
        credentials: "include",
      });
      const data = await res.json();
      setSession(data);
      
      // Show profile setup popup if connected but no displayName (MANDATORY)
      if (data?.status === "connected" && !data?.displayName) {
        setShowProfileSetup(true);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setLoadingSession(false);
    }
  };

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Format phone number for display
  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "Not connected";
    // Add + if not present and format
    const cleaned = phone.replace(/\D/g, "");
    return `+${cleaned}`;
  };

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <IconBrandTabler className="text-foreground/80 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Blast",
      href: "/blast",
      icon: (
        <IconSpeakerphone className="text-foreground/80 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Bot",
      href: "/bot",
      icon: (
        <IconMessageChatbot className="text-foreground/80 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Contact",
      href: "/contact",
      icon: (
        <IconUsers className="text-foreground/80 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  // Early return for login page - AFTER all hooks
  if (isLoginPage) {
    return <>{children}</>;
  }

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = () => {
    if (!mounted) return <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />;
    if (theme === "light") return <IconSun size={18} className="text-amber-500" />;
    if (theme === "dark") return <IconMoon size={18} className="text-blue-400" />;
    return <IconDeviceDesktop size={18} className="text-neutral-500" />;
  };

  const displayPhone = formatPhone(session?.phoneNumber);
  const displayName = session?.displayName || displayPhone;
  const connectionStatus = session?.status === "connected" ? "Online" : "Offline";

  const handleProfileSetupComplete = (data: { displayName: string; about: string }) => {
    setShowProfileSetup(false);
    // Update session with new data
    setSession(prev => prev ? { ...prev, displayName: data.displayName } : null);
  };

  return (
    <>
      {/* Profile Setup Modal - First time login */}
      <ProfileSetupModal
        isOpen={showProfileSetup}
        onComplete={handleProfileSetupComplete}
        phoneNumber={session?.phoneNumber || undefined}
      />
      
      <div
        className={cn(
          "rounded-md flex flex-col md:flex-row bg-background w-full flex-1 mx-auto border-border overflow-hidden",
          "h-screen" // Full screen height
        )}
      >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 border-t border-border pt-4 pb-2">
             <div className="flex items-center justify-between gap-2 px-2">
                <div 
                  onClick={() => setShowProfileDrawer(true)}
                  className="flex items-center gap-2 cursor-pointer group/profile flex-1"
                >
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 group-hover/profile:bg-green-500 transition-all group-hover/profile:text-white overflow-hidden">
                    {session?.profilePicUrl ? (
                      <img src={session.profilePicUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <IconUserCircle size={20} />
                    )}
                  </div>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex flex-col overflow-hidden"
                      >
                        {loadingSession ? (
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-foreground truncate">
                              {displayPhone}
                            </span>
                            <span className={cn(
                              "text-[10px] truncate",
                              session?.status === "connected" ? "text-green-500" : "text-muted-foreground"
                            )}>
                              {connectionStatus}
                            </span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {open && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={toggleTheme}
                      className="w-8 h-8 rounded-full bg-muted dark:bg-neutral-700 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors shadow-sm"
                      title={`Current theme: ${theme || 'system'}`}
                    >
                      <ThemeIcon />
                    </motion.button>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 overflow-hidden p-4 md:p-10 bg-background border-l border-border rounded-tl-2xl relative">
        {children}
        
        {/* Profile Drawer */}
        <AnimatePresence>
          {showProfileDrawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowProfileDrawer(false)}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40 rounded-tl-2xl"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-80 bg-card shadow-2xl z-50 border-l border-border p-6 flex flex-col justify-between rounded-tl-2xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold font-display text-foreground">User Profile</h2>
                    <button onClick={() => setShowProfileDrawer(false)} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground">
                      <IconX size={20} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center mb-8 bg-muted/30 p-6 rounded-3xl border border-border">
                    <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-green-500/20 overflow-hidden">
                      {session?.profilePicUrl ? (
                        <img src={session.profilePicUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <IconUser size={40} />
                      )}
                    </div>
                    <p className="font-bold text-lg">{displayPhone}</p>
                    <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1">
                      {session?.displayName || "WhatsApp User"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Link 
                      href="/profile" 
                      onClick={() => setShowProfileDrawer(false)}
                      className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:bg-muted/50 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <IconUser size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">WhatsApp Profile</p>
                        <p className="text-[10px] text-neutral-500 italic">Manage your WhatsApp identity</p>
                      </div>
                    </Link>
                  </div>
                </div>

                <button 
                  type="button"
                  className="flex items-center justify-center gap-2 p-4 w-full bg-red-500/10 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all group shadow-sm active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleLogout();
                  }}
                >
                  <IconLogout size={20} className="group-hover:rotate-12 transition-transform" />
                  Logout Account
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
    </>
  );
}

const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-neutral-800 dark:text-neutral-100 py-1 relative z-20"
    >
      <div className="h-6 w-7 bg-green-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-foreground whitespace-pre"
      >
        burhan2ws
      </motion.span>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-neutral-800 dark:text-neutral-100 py-1 relative z-20"
    >
      <div className="h-6 w-7 bg-green-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};
