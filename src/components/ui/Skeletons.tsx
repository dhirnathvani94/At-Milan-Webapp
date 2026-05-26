/**
 * Skeletons.tsx — Centralized skeleton loading components
 * Uses react-loading-skeleton for shimmer effect
 */
import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// ── Theme wrapper ────────────────────────────────────────────────────────────
export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="#e8e8e8" highlightColor="#f5f5f5">
      {children}
    </SkeletonTheme>
  );
}

// ── Base building blocks ─────────────────────────────────────────────────────

/** Generic avatar circle */
export function AvatarSkeleton({ size = 56 }: { size?: number }) {
  return <Skeleton circle width={size} height={size} />;
}

/** Horizontal line of text */
export function TextSkeleton({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: 6 }} />;
}

// ── Profile card skeleton (Browse / Discover page) ───────────────────────────
export function ProfileCardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        {/* Photo area */}
        <Skeleton height={240} style={{ display: 'block' }} />
        {/* Info area */}
        <div className="p-4 space-y-2">
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={13} />
          <div className="flex gap-2 mt-3">
            <Skeleton width={80} height={30} style={{ borderRadius: 20 }} />
            <Skeleton width={80} height={30} style={{ borderRadius: 20 }} />
          </div>
        </div>
      </div>
    </SkeletonProvider>
  );
}

/** Grid of profile cards */
export function ProfileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProfileCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Profile detail skeleton (ViewProfilePage) ────────────────────────────────
export function ProfileDetailSkeleton() {
  return (
    <SkeletonProvider>
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        {/* Hero / cover */}
        <div className="rounded-2xl overflow-hidden">
          <Skeleton height={320} style={{ display: 'block' }} />
        </div>
        {/* Name + meta */}
        <div className="flex items-start gap-4">
          <Skeleton circle width={80} height={80} />
          <div className="flex-1 space-y-2">
            <Skeleton width="50%" height={24} />
            <Skeleton width="35%" height={14} />
            <Skeleton width="25%" height={14} />
          </div>
        </div>
        {/* Detail cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <Skeleton width={140} height={18} />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton width="40%" height={11} />
                  <Skeleton width="70%" height={14} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── Dashboard page skeleton ──────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
              <Skeleton circle width={44} height={44} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={22} />
            </div>
          ))}
        </div>
        {/* Section heading */}
        <Skeleton width={180} height={20} />
        {/* Profile cards */}
        <ProfileGridSkeleton count={4} />
      </div>
    </SkeletonProvider>
  );
}

// ── List item skeleton (notifications, interests, messages) ──────────────────
export function ListItemSkeleton({ showAvatar = true }: { showAvatar?: boolean }) {
  return (
    <SkeletonProvider>
      <div className="flex items-center gap-3 py-3 px-4">
        {showAvatar && <Skeleton circle width={48} height={48} />}
        <div className="flex-1 space-y-1.5">
          <Skeleton width="55%" height={14} />
          <Skeleton width="80%" height={12} />
        </div>
        <Skeleton width={40} height={12} />
      </div>
    </SkeletonProvider>
  );
}

export function ListSkeleton({ count = 6, showAvatar = true }: { count?: number; showAvatar?: boolean }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} showAvatar={showAvatar} />
      ))}
    </div>
  );
}

// ── Chat list skeleton (MessagesPage) ────────────────────────────────────────
export function ChatListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <SkeletonProvider>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-4">
            <Skeleton circle width={52} height={52} />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between">
                <Skeleton width="40%" height={14} />
                <Skeleton width={30} height={11} />
              </div>
              <Skeleton width="70%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── Chat messages skeleton ───────────────────────────────────────────────────
export function ChatMessagesSkeleton() {
  return (
    <SkeletonProvider>
      <div className="space-y-4 p-4">
        {[false, true, false, false, true, false, true].map((right, i) => (
          <div key={i} className={`flex gap-2 ${right ? 'flex-row-reverse' : 'flex-row'}`}>
            {!right && <Skeleton circle width={32} height={32} />}
            <div className={`space-y-1 max-w-[60%] ${right ? 'items-end' : 'items-start'} flex flex-col`}>
              <Skeleton width={120 + (i % 3) * 40} height={36} style={{ borderRadius: 16 }} />
              <Skeleton width={40} height={10} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── Admin table skeleton ─────────────────────────────────────────────────────
export function AdminTableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <SkeletonProvider>
      <div className="overflow-hidden">
        {/* Header */}
        <div className={`grid gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width="70%" height={13} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className={`grid gap-4 px-4 py-4 border-b border-gray-100`}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              c === 0
                ? <div key={c} className="flex items-center gap-2">
                    <Skeleton circle width={36} height={36} />
                    <Skeleton width="60%" height={13} />
                  </div>
                : <Skeleton key={c} width={`${50 + (c * 10) % 40}%`} height={13} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── Admin stat card skeleton ─────────────────────────────────────────────────
export function AdminStatCardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
        <div className="flex justify-between items-start">
          <Skeleton width="50%" height={13} />
          <Skeleton circle width={38} height={38} />
        </div>
        <Skeleton width="40%" height={28} />
        <Skeleton width="30%" height={11} />
      </div>
    </SkeletonProvider>
  );
}

export function AdminStatsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AdminStatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Notification skeleton ────────────────────────────────────────────────────
export function NotificationItemSkeleton() {
  return (
    <SkeletonProvider>
      <div className="flex gap-3 p-4 border-b border-gray-100">
        <Skeleton circle width={44} height={44} />
        <div className="flex-1 space-y-1.5">
          <Skeleton width="50%" height={14} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="25%" height={11} />
        </div>
      </div>
    </SkeletonProvider>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <NotificationItemSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Interests / Matches page skeleton ───────────────────────────────────────
export function InterestCardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
        <Skeleton circle width={64} height={64} />
        <div className="flex-1 space-y-2">
          <Skeleton width="50%" height={15} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="40%" height={12} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={36} height={36} style={{ borderRadius: 10 }} />
          <Skeleton width={36} height={36} style={{ borderRadius: 10 }} />
        </div>
      </div>
    </SkeletonProvider>
  );
}

export function InterestListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <InterestCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Settings page skeleton ───────────────────────────────────────────────────
export function SettingsSkeleton() {
  return (
    <SkeletonProvider>
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <Skeleton width="30%" height={16} />
            </div>
            <div className="p-5 space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton width={140} height={14} />
                    <Skeleton width={200} height={11} />
                  </div>
                  <Skeleton width={48} height={26} style={{ borderRadius: 20 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── My Profile skeleton ──────────────────────────────────────────────────────
export function MyProfileSkeleton() {
  return (
    <SkeletonProvider>
      <div className="max-w-4xl mx-auto space-y-5 p-4">
        {/* Cover */}
        <Skeleton height={200} style={{ borderRadius: 20, display: 'block' }} />
        {/* Avatar + name */}
        <div className="flex items-end gap-4 -mt-12 px-4">
          <Skeleton circle width={96} height={96} />
          <div className="flex-1 pb-2 space-y-2">
            <Skeleton width="40%" height={20} />
            <Skeleton width="25%" height={13} />
          </div>
          <Skeleton width={100} height={38} style={{ borderRadius: 12 }} />
        </div>
        {/* Tabs */}
        <div className="flex gap-3 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={80} height={34} style={{ borderRadius: 20 }} />
          ))}
        </div>
        {/* Content sections */}
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <Skeleton width={120} height={16} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton width="45%" height={11} />
                  <Skeleton width="75%" height={14} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonProvider>
  );
}

// ── Membership / Plans page skeleton ────────────────────────────────────────
export function PlanCardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 space-y-4">
        <Skeleton width="40%" height={20} />
        <Skeleton width="55%" height={32} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton circle width={18} height={18} />
            <Skeleton width="70%" height={13} />
          </div>
        ))}
        <Skeleton height={44} style={{ borderRadius: 12 }} />
      </div>
    </SkeletonProvider>
  );
}

export function PlansSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <PlanCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Shortlist / Who Viewed Me skeleton ───────────────────────────────────────
export function CompactProfileSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
        <Skeleton height={180} style={{ display: 'block' }} />
        <div className="p-3 space-y-1">
          <Skeleton width="65%" height={14} />
          <Skeleton width="45%" height={12} />
        </div>
      </div>
    </SkeletonProvider>
  );
}

export function CompactGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CompactProfileSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Success Stories skeleton ─────────────────────────────────────────────────
export function StoryCardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
        <Skeleton height={200} style={{ display: 'block' }} />
        <div className="p-5 space-y-3">
          <Skeleton width="55%" height={18} />
          <Skeleton width="85%" height={13} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="60%" height={13} />
          <div className="flex gap-2 mt-2">
            <Skeleton width={60} height={24} style={{ borderRadius: 20 }} />
            <Skeleton width={60} height={24} style={{ borderRadius: 20 }} />
          </div>
        </div>
      </div>
    </SkeletonProvider>
  );
}

// ── Admin Dashboard overview skeleton ────────────────────────────────────────
export function AdminDashboardSkeleton() {
  return (
    <SkeletonProvider>
      <div className="space-y-6">
        <AdminStatsSkeleton count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <Skeleton width={180} height={18} />
            <Skeleton height={200} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <Skeleton width={150} height={18} />
            <ListSkeleton count={5} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <Skeleton width={160} height={18} />
          </div>
          <AdminTableSkeleton rows={5} cols={5} />
        </div>
      </div>
    </SkeletonProvider>
  );
}

// ── Search page skeleton ─────────────────────────────────────────────────────
export function SearchSkeleton() {
  return (
    <SkeletonProvider>
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={110} height={36} style={{ borderRadius: 10 }} />
          ))}
        </div>
        {/* Result count */}
        <Skeleton width={160} height={14} />
        {/* Profile grid */}
        <ProfileGridSkeleton count={12} />
      </div>
    </SkeletonProvider>
  );
}

// ── Full Chat page skeleton (MessagesPage) ───────────────────────────────────
export function ChatSkeleton() {
  return (
    <SkeletonProvider>
      <div className="flex h-[calc(100vh-160px)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Left: conversation list */}
        <div className="w-full lg:w-96 border-r border-gray-100 flex flex-col">
          <div className="p-5 border-b border-gray-50 bg-gray-50/50">
            <Skeleton width="40%" height={22} className="mb-4" />
            <Skeleton height={38} style={{ borderRadius: 12 }} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatListSkeleton count={8} />
          </div>
        </div>
        {/* Right: message area */}
        <div className="hidden lg:flex flex-col flex-1 bg-gray-50/30">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-3">
            <Skeleton circle width={44} height={44} />
            <div className="flex-1 space-y-1">
              <Skeleton width="35%" height={14} />
              <Skeleton width="20%" height={11} />
            </div>
            <Skeleton width={80} height={32} style={{ borderRadius: 10 }} />
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-hidden p-4">
            <ChatMessagesSkeleton />
          </div>
          {/* Input */}
          <div className="p-4 border-t border-gray-100 bg-white">
            <Skeleton height={48} style={{ borderRadius: 24 }} />
          </div>
        </div>
      </div>
    </SkeletonProvider>
  );
}

// ── Who Viewed Me skeleton ────────────────────────────────────────────────────
export function WhoViewedMeSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton width="30%" height={28} />
          <Skeleton width="50%" height={14} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Skeleton height={180} style={{ display: 'block' }} />
              <div className="p-3 space-y-1">
                <Skeleton width="65%" height={14} />
                <Skeleton width="45%" height={12} />
                <Skeleton width="55%" height={11} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonProvider>
  );
}

// ── Generic full-page loader ─────────────────────────────────────────────────
export function PageSkeleton() {
  return (
    <SkeletonProvider>
      <div className="space-y-4 p-4">
        <Skeleton height={40} width="50%" />
        <Skeleton height={16} width="80%" />
        <Skeleton height={16} width="65%" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} style={{ borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </SkeletonProvider>
  );
}
