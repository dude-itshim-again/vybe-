import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  Plus,
  ThumbsUp,
  X,
  Play,
  RotateCcw,
  LogOut,
  Sparkles,
  Music,
} from 'lucide-react';
import { liveJam, JamRoom } from '../../services/socialEngine';
import { userLibrary } from '../../services/userLibraryService';
import { TrackMetadata } from '../../providers/types';
import { fetchCatalogSearch, EchoTrack } from '../../services/streamResolver';

interface JamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  onPlaySong: (track: TrackMetadata) => void;
}

export const JamSessionModal: React.FC<JamSessionModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  currentTime,
  isPlaying,
  onPlaySong,
}) => {
  const [room, setRoom] = useState<JamRoom | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EchoTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const currentUser = userLibrary.getCurrentUser();
  const userPayload = {
    id: currentUser.id,
    name: currentUser.name,
    avatarColor: currentUser.avatarColor,
  };

  useEffect(() => {
    if (!isOpen) return;

    const unsub = liveJam.onRoomUpdate((activeRoom) => {
      setRoom(activeRoom);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateJam = async () => {
    setJoinError('');
    await liveJam.createJam(userPayload, currentTrack, currentTime, isPlaying);
  };

  const handleJoinJam = async () => {
    if (!inputCode.trim()) return;
    setJoinError('');
    const res = await liveJam.joinJam(inputCode, userPayload);
    if (!res.success) {
      setJoinError(res.error || 'Could not join jam room');
    }
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.roomCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSearchSongs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await fetchCatalogSearch(searchQuery);
      setSearchResults(results.slice(0, 10));
    } catch (_) {}
    setIsSearching(false);
  };

  const handleAddSong = async (track: EchoTrack) => {
    await liveJam.addSongToQueue(
      {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        artworkUrl: track.artworkUrl,
        streamUrl: track.streamUrl,
        sourceType: 'stream',
      },
      userPayload
    );
    setShowAddDrawer(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleVote = async (trackId: string) => {
    await liveJam.voteTrack(trackId);
  };

  const handleSyncToHost = () => {
    if (room?.currentTrack) {
      onPlaySong(room.currentTrack);
    }
  };

  const handleLeaveJam = async () => {
    await liveJam.leaveJam(userPayload);
  };

  const isHost = room?.hostUser?.id === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Live Jam Session
                {room && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                    {room.roomCode}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">Shared queue & real-time synchronized listening</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Not in a Room: Create or Join */}
        {!room ? (
          <div className="p-6 space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-900/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Listen Together in Real Time</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Invite friends anywhere to join your room, control the queue, vote on upcoming tracks, and enjoy synchronized playback.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Jam */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Start a New Jam</h4>
                  <p className="text-xs text-zinc-400">You will be the DJ host and can invite your friends with a 6-digit code.</p>
                </div>
                <button
                  onClick={handleCreateJam}
                  className="mt-4 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-purple-950 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Start Live Jam
                </button>
              </div>

              {/* Join Jam */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Join Existing Jam</h4>
                  <p className="text-xs text-zinc-400 mb-3">Enter the 6-digit room code from your friend.</p>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="VYB-123"
                    maxLength={8}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-center font-mono tracking-widest text-white uppercase placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                  />
                  {joinError && <p className="text-xs text-rose-400 mt-1.5">{joinError}</p>}
                </div>
                <button
                  onClick={handleJoinJam}
                  className="mt-4 w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs tracking-wide transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Room View */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Room Info Bar */}
            <div className="p-4 bg-purple-950/20 border-b border-purple-500/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400">Room Code:</span>
                  <span className="font-mono text-base font-bold text-white tracking-wider bg-black/40 px-2.5 py-1 rounded-lg border border-purple-500/30">
                    {room.roomCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                  title="Copy Room Code"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isHost && (
                  <button
                    onClick={handleSyncToHost}
                    className="py-1 px-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Sync to Host
                  </button>
                )}
                <button
                  onClick={handleLeaveJam}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                  title="Leave Jam"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Participants avatars */}
            <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3 overflow-x-auto">
              <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Listeners ({room.participants.length}):</span>
              <div className="flex items-center -space-x-2">
                {room.participants.map((p) => (
                  <div
                    key={p.id}
                    className="relative w-8 h-8 rounded-full border-2 border-[#111116] flex items-center justify-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: p.avatarColor }}
                    title={`${p.name}${p.isHost ? ' (Host DJ)' : ''}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                    {p.isHost && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center text-[7px] text-black font-extrabold">
                        ★
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Currently Playing in Jam */}
            {room.currentTrack && (
              <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    {room.currentTrack.artworkUrl ? (
                      <img src={room.currentTrack.artworkUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-6 h-6 text-zinc-500 m-3" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">Now Playing</span>
                    <h4 className="text-sm font-semibold text-white truncate max-w-[220px]">{room.currentTrack.title}</h4>
                    <p className="text-xs text-zinc-400 truncate max-w-[220px]">{room.currentTrack.artist}</p>
                  </div>
                </div>
                <button
                  onClick={() => onPlaySong(room.currentTrack!)}
                  className="p-2.5 rounded-full bg-purple-500 hover:bg-purple-400 text-white shadow-lg transition-transform hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>
            )}

            {/* Shared Queue List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Shared Queue ({room.queue.length})
                </span>
                <button
                  onClick={() => setShowAddDrawer(!showAddDrawer)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Song
                </button>
              </div>

              {/* Add Song Drawer */}
              {showAddDrawer && (
                <div className="p-3 mb-3 rounded-xl bg-white/[0.04] border border-purple-500/30 space-y-2">
                  <form onSubmit={handleSearchSongs} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search JioSaavn / Catalog..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                    >
                      {isSearching ? '...' : 'Search'}
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                      {searchResults.map((t) => (
                        <div
                          key={t.id}
                          className="py-2 flex items-center justify-between hover:bg-white/5 px-2 rounded-lg cursor-pointer"
                          onClick={() => handleAddSong(t)}
                        >
                          <div className="truncate max-w-[260px]">
                            <p className="text-xs text-white font-medium truncate">{t.title}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{t.artist}</p>
                          </div>
                          <button className="p-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 text-xs">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {room.queue.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  Queue is empty. Click "+ Add Song" to queue tracks for everyone!
                </div>
              ) : (
                room.queue.map((item, idx) => (
                  <div
                    key={`${(item.track as any)?.id || idx}-${idx}`}
                    className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-xs font-mono text-zinc-500 w-4 text-center">{idx + 1}</span>
                      <div className="truncate">
                        <p className="text-xs font-medium text-white truncate">{item.track.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-zinc-400 truncate">{item.track.artist}</span>
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded-full font-medium text-white flex items-center gap-1"
                            style={{ backgroundColor: `${item.addedBy.avatarColor}66` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.addedBy.avatarColor }} />
                            {item.addedBy.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVote(item.track.id)}
                        className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
                        title="Upvote song"
                      >
                        <ThumbsUp className="w-3 h-3 text-purple-400" />
                        <span className="text-[11px] font-mono">{item.votes || 1}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
