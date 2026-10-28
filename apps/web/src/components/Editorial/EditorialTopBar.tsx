import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Users,
  Zap,
  X,
  Disc3,
  Keyboard,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { VybeUser } from '../../services/userLibraryService';
import { StorageStats } from '../../services/offlineVault';
import { EditorialTab } from './EditorialSidebar';

interface EditorialTopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  onNavigateTab: (tab: EditorialTab) => void;
  currentUser?: VybeUser;
  storageStats: StorageStats;
  likedCount?: number;
  playlistCount?: number;
  recentlyPlayedCount?: number;
  onOpenProfile: () => void;
  onOpenJam: () => void;
  onOpenWrapped: () => void;
  onOpenShortcuts?: () => void;
  isAutoMixActive?: boolean;
  onToggleAutoMix?: () => void;
  searchInputRef?: React.Ref<HTMLInputElement>;
  onLogout?: () => void;
}

export const EditorialTopBar: React.FC<EditorialTopBarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onNavigateTab,
  currentUser,
  storageStats,
  likedCount = 0,
  playlistCount = 0,
  recentlyPlayedCount = 0,
  onOpenProfile,
  onOpenJam,
  onOpenWrapped,
  onOpenShortcuts,
  isAutoMixActive = false,
  onToggleAutoMix,
  searchInputRef,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const initials = currentUser?.name
    ? currentUser.name.slice(0, 2).toUpperCase()
    : 'VY';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onSearchSubmit(searchQuery);
      onNavigateTab('search');
    }
  };

  return (
    <header className="h-16 shrink-0 border-b border-white/[0.08] px-5 sm:px-8 flex items-center justify-between gap-4 select-none bg-[#07080C]/40 backdrop-blur-md z-20">
      {/* ─────────────────────────────────────────────────────────────────────────
          LEFT: < > Navigation Chevrons + Wide Frosted Search Input
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        {/* < > Chevrons */}
        <div className="flex items-center gap-1.5 shrink-0 text-white/50">
          <button
            onClick={() => onNavigateTab('home')}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Go to Discover"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateTab('search')}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Go to Search"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Unified Top Frosted Glass Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            id="unified-search-input"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              onSearchChange(val);
              onNavigateTab('search');
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                onNavigateTab('search');
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums... (⌘K)"
            className="w-full h-9 pl-10 pr-9 rounded-full glass-input text-xs text-white placeholder-white/40 font-sans focus:outline-none focus:border-white/25 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          RIGHT: AutoMix DJ, Live Jam, Wrapped, Offline Vault, Micro-Motto, Avatar
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* ⚡ AutoMix DJ Button */}
        <button
          onClick={onToggleAutoMix}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer shadow-md ${
            isAutoMixActive
              ? 'bg-gradient-to-r from-[#E86538]/25 to-purple-600/25 border-2 border-[#E86538] text-white shadow-[0_0_18px_rgba(232,101,56,0.5)]'
              : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-white/80 hover:text-white'
          }`}
          title="Toggle AutoMix DJ Seamless Crossfade"
        >
          <Disc3 className={`w-3.5 h-3.5 ${isAutoMixActive ? 'animate-spin text-[#E86538]' : 'text-purple-400'}`} />
          <span>⚡ AutoMix DJ</span>
          {isAutoMixActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E86538] animate-ping ml-0.5" />
          )}
        </button>

        {/* Live Jam Button */}
        <button
          onClick={onOpenJam}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-purple-300 transition-all cursor-pointer shadow-sm"
          title="Start Live Jam Session"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Live Jam</span>
        </button>

        {/* Wrapped Button */}
        <button
          onClick={onOpenWrapped}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-pink-300 transition-all cursor-pointer shadow-sm"
          title="Vybe Wrapped 2026"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Wrapped</span>
        </button>

        {/* Keyboard Shortcuts Trigger Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-white/70 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#E86538]" />
            <span className="hidden xl:inline">Keys</span>
            <kbd className="px-1 py-0.2 rounded bg-white/10 text-[10px] text-white/60 font-mono">?</kbd>
          </button>
        )}

        {/* Offline Vault Pill */}
        <button
          onClick={onOpenProfile}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-bold transition-all cursor-pointer"
          title="Offline Vault & Storage"
        >
          <Zap className="w-3 h-3 fill-current" />
          <span>{storageStats.count} Offline</span>
        </button>

        {/* LISTEN DEEPLY. Uppercase Micro-Motto */}
        <div className="hidden lg:block text-[11px] font-mono tracking-[0.16em] uppercase text-white/45 font-semibold">
          LISTEN DEEPLY.
        </div>

        {/* Vertical Divider */}
        <div className="hidden lg:block h-3.5 w-px bg-white/20" />

        {/* Settings / Storage Vault Button */}
        <button
          onClick={onOpenProfile}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/15 text-white/70 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 group"
          title="Settings & Storage Vault"
        >
          <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
        </button>

        {/* Real Signed-In User Identity Button */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 transition-all cursor-pointer shadow-sm group active:scale-95"
            title="Account & Session Menu"
          >
            {/* Glowing glass badge with initials */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono text-white shrink-0 border border-white/20 shadow-[0_0_12px_rgba(37,99,235,0.35)]"
              style={{ backgroundColor: currentUser?.avatarColor || '#2563EB' }}
            >
              {initials}
            </div>

            {/* Real Display Name & Green Online Dot */}
            <div className="hidden sm:flex items-center gap-2 max-w-[130px]">
              <span className="text-xs font-semibold text-white truncate font-sans">
                {currentUser?.name || 'Vybe Member'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] shrink-0" />
            </div>
          </button>

          {/* Liquid Glass User Popover Menu */}
          {isUserMenuOpen && (
            <div
              className="absolute right-0 top-11 w-68 p-3.5 rounded-2xl backdrop-blur-3xl bg-[#0E1018]/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7)] z-50 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* User Info Header: Signed in as: Full Name (user.email) */}
              <div className="flex items-center gap-3 pb-2.5 border-b border-white/10">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono text-white shrink-0 border border-white/20 shadow-md"
                  style={{ backgroundColor: currentUser?.avatarColor || '#2563EB' }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider font-mono">
                    Signed in as
                  </div>
                  <div className="text-xs font-bold text-white truncate font-sans">
                    {currentUser?.name || 'Vybe Member'}
                  </div>
                  <div className="text-[11px] text-white/50 truncate font-mono">
                    {currentUser?.email || 'user@vybe.fm'}
                  </div>
                </div>
              </div>

              {/* Real Stats Row: N Liked Songs · N Playlists · N Played Tracks */}
              <div className="flex items-center justify-around py-2 px-1 rounded-xl bg-white/[0.04] border border-white/5 text-[11px] font-mono text-white/70">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-white text-xs">{likedCount}</span>
                  <span className="text-[10px] text-white/40">Liked</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="font-bold text-white text-xs">{playlistCount}</span>
                  <span className="text-[10px] text-white/40">Playlists</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="font-bold text-white text-xs">{recentlyPlayedCount}</span>
                  <span className="text-[10px] text-white/40">Played</span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono">
                <span className="text-white/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Session</span>
                </span>
                <span className="text-emerald-400 font-bold">Cloud Synced</span>
              </div>

              {/* Profile Details Button */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left font-sans"
              >
                <User className="w-3.5 h-3.5 text-white/60" />
                <span>Account & Storage Vault</span>
              </button>

              {/* Sign Out Button */}
              {onLogout && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left font-sans"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default EditorialTopBar;
