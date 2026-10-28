import React, { useState, useEffect } from 'react';
import {
  Compass,
  Search,
  Radio,
  Heart,
  Clock,
  Plus,
  ArrowUpRight,
  ListMusic,
} from 'lucide-react';
import { userLibrary, VybePlaylist } from '../../services/userLibraryService';

export type EditorialTab =
  | 'home'
  | 'search'
  | 'radio'
  | 'queue'
  | 'playlist'
  | 'library'
  | 'favorites'
  | 'recent';

interface EditorialSidebarProps {
  activeTab: EditorialTab;
  onSelectTab: (tab: EditorialTab) => void;
  selectedPlaylistId: string | null;
  onSelectPlaylist: (playlistId: string) => void;
  onOpenStudioDrawer: () => void;
  onOpenCreatePlaylistModal: () => void;
  onFocusSearch?: () => void;
  likedTracksCount?: number;
  className?: string;
}

export const EditorialSidebar: React.FC<EditorialSidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedPlaylistId,
  onSelectPlaylist,
  onOpenStudioDrawer,
  onOpenCreatePlaylistModal,
  onFocusSearch,
  likedTracksCount,
  className = '',
}) => {
  const [playlists, setPlaylists] = useState<VybePlaylist[]>(() =>
    userLibrary.getUserPlaylists()
  );
  const [liveLikedCount, setLiveLikedCount] = useState<number>(() =>
    userLibrary.getLikedTracks().length
  );

  useEffect(() => {
    const updateLibrary = () => {
      setPlaylists(userLibrary.getUserPlaylists());
      setLiveLikedCount(userLibrary.getLikedTracks().length);
    };
    const unsub = userLibrary.subscribe(updateLibrary);
    return unsub;
  }, []);

  const displayLikedCount =
    typeof likedTracksCount === 'number' ? likedTracksCount : liveLikedCount;

  return (
    <aside
      className={`w-[240px] shrink-0 h-full flex flex-col justify-between p-4 pb-24 border-r border-white/10 select-none bg-[#07080C]/80 backdrop-blur-2xl z-20 overflow-y-auto custom-scrollbar ${className}`}
    >
      <div className="flex flex-col gap-6">
        {/* 1. BRAND HEADER: Anime Character Logo + Vybe. */}
        <div className="flex items-center gap-3 px-2 py-1">
          <img
            src="/logo.png"
            alt="Vybe"
            className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          />
          <span className="font-bold text-xl tracking-tight text-white font-sans flex items-baseline">
            Vybe<span className="text-[#E86538]">.</span>
          </span>
        </div>

        {/* 2. PRIMARY NAVIGATION (Discover, Search, Radio) */}
        <nav className="flex flex-col gap-1">
          {/* Discover */}
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center justify-between px-3 py-2 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'glass-pill-active text-white font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-white/80" />
              <span>Discover</span>
            </div>
            {activeTab === 'home' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]" />
            )}
          </button>

          {/* Search */}
          <button
            onClick={() => {
              onSelectTab('search');
              onFocusSearch?.();
            }}
            className={`flex items-center justify-between px-3 py-2 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'glass-pill-active text-white font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-white/80" />
              <span>Search</span>
            </div>
            {activeTab === 'search' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]" />
            )}
          </button>

          {/* Radio */}
          <button
            onClick={() => onSelectTab('radio')}
            className={`flex items-center justify-between px-3 py-2 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'radio'
                ? 'glass-pill-active text-white font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-white/80" />
              <span>Radio</span>
            </div>
            {activeTab === 'radio' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]" />
            )}
          </button>
        </nav>

        {/* 3. YOUR LIBRARY SECTION (Favorites, Recently played) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="px-3 text-[10px] font-mono tracking-[0.14em] uppercase text-white/40 font-semibold">
            YOUR LIBRARY
          </div>

          <div className="flex flex-col gap-0.5">
            {/* Favorites with LIVE COUNT BADGE (NO HARDCODED 128!) */}
            <button
              onClick={() => onSelectTab('favorites')}
              className={`flex items-center justify-between px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/65 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Heart
                  className={`w-3.5 h-3.5 ${
                    displayLikedCount > 0
                      ? 'text-[#E86538] fill-[#E86538]'
                      : 'text-white/70'
                  }`}
                />
                <span>Favorites</span>
              </div>
              {displayLikedCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#E86538]/20 text-[#E86538] border border-[#E86538]/30 font-semibold">
                  {displayLikedCount}
                </span>
              )}
            </button>

            {/* Recently Played */}
            <button
              onClick={() => onSelectTab('recent')}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'recent'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/65 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-white/70" />
              <span>Recently played</span>
            </button>
          </div>
        </div>

        {/* 4. YOUR PLAYLISTS SECTION (Real User Playlists only) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between px-3">
            <span className="text-[10px] font-mono tracking-[0.14em] uppercase text-white/40 font-semibold">
              YOUR PLAYLISTS
            </span>
            <button
              onClick={onOpenCreatePlaylistModal}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Create Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {playlists.length > 0 ? (
              playlists.map((pl) => {
                const isSelected = activeTab === 'playlist' && selectedPlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl.id)}
                    className={`flex items-center gap-2 text-left px-3 py-1.5 rounded-[10px] text-xs font-medium truncate transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-white/65 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ListMusic className="w-3 h-3 text-white/40 shrink-0" />
                    <span className="truncate">{pl.name}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-1 text-[11px] text-white/35 italic font-sans">
                No playlists yet
              </div>
            )}

            <button
              onClick={onOpenCreatePlaylistModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-medium text-white/45 hover:text-white transition-all cursor-pointer mt-1"
            >
              <Plus className="w-3 h-3" />
              <span>New playlist</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM LOSSLESS CALLOUT CARD */}
      <div className="mt-6 p-3.5 rounded-[16px] glass-card border border-white/10 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[#3B82F6]">
          <div className="flex items-end gap-[2px] h-3">
            <span className="w-[2px] h-2 bg-[#3B82F6] rounded-full" />
            <span className="w-[2px] h-3 bg-[#3B82F6] rounded-full" />
            <span className="w-[2px] h-1.5 bg-[#3B82F6] rounded-full" />
          </div>
          <span className="text-[11px] font-semibold text-white">
            A better kind of listening.
          </span>
        </div>
        <p className="text-[10px] text-white/50 leading-tight">
          Lossless audio. Nothing lost.
        </p>
        <button
          onClick={onOpenStudioDrawer}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#3B82F6] hover:text-[#60A5FA] transition-colors cursor-pointer pt-0.5"
        >
          <span>Explore Vybe Studio</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};

export default EditorialSidebar;
