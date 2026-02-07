"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Initial placeholder for auth check
        const isAuthenticated = false; // This will come from Better Auth
        if (isAuthenticated) {
            router.push("/dashboard");
        } else {
            router.push("/login");
        }
    }, [router]);

  return (
      <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-neutral-900">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
