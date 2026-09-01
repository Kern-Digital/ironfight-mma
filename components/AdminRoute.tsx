"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, useRights } from "@/lib/auth-context";
import Skeleton from "@/components/ui/Skeleton";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading } = useAuth();
  const router = useRouter();

  const isReady = !loading && !profileLoading;
  const isAdmin = useRights().admin;

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (!isAdmin) { router.replace("/dashboard"); }
  }, [isReady, user, isAdmin, router]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
