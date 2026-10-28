import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  LogIn,
  UserPlus,
  Download,
  Upload,
  HardDrive,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { userLibrary, VybeUser } from '../../services/userLibraryService';
import { offlineVault, StorageStats } from '../../services/offlineVault';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const [currentUser, setCurrentUser] = useState<VybeUser>(() => userLibrary.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'profile' | 'auth'>('profile');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [nameInput, setNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>({ count: 0, totalBytes: 0, totalMB: '0.0' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentUser(userLibrary.getCurrentUser());
    offlineVault.getStorageStats().then(setStorageStats);

    const unsubscribeUser = userLibrary.subscribe(() => {
      setCurrentUser(userLibrary.getCurrentUser());
    });

    const unsubscribeVault = offlineVault.subscribe(() => {
      offlineVault.getStorageStats().then(setStorageStats);
    });

    return () => {
      unsubscribeUser();
      unsubscribeVault();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      showFeedback('Please provide a valid email address.', 'error');
      return;
    }

    try {
      if (authMode === 'signup') {
        const u = await userLibrary.signUp(nameInput, emailInput);
        setCurrentUser(u);
        showFeedback(`Welcome to Vybe, ${u.name}!`);
      } else {
        const u = await userLibrary.login(emailInput);
        setCurrentUser(u);
        showFeedback(`Logged in as ${u.name}!`);
      }
      setActiveTab('profile');
      setNameInput('');
      setEmailInput('');
    } catch {
      showFeedback('Authentication failed.', 'error');
    }
  };

  const handleSwitchToGuest = () => {
    const guest = userLibrary.switchToGuest();
    setCurrentUser(guest);
    showFeedback('Switched to Demo Guest Profile.');
    setActiveTab('profile');
  };

  const handleExportBackup = () => {
    const jsonStr = userLibrary.exportLibraryBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vybe_library_${currentUser.name.replace(/\s+/g, '_').toLowerCase()}.vybe.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    showFeedback('Exported library backup (.vybe.json)!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = userLibrary.importLibraryBackup(content);
        if (success) {
          setCurrentUser(userLibrary.getCurrentUser());
          showFeedback('Library restored successfully from backup!');
        } else {
          showFeedback('Failed to parse .vybe.json backup.', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearOfflineCache = async () => {
    if (!window.confirm('Are you sure you want to remove all offline downloaded tracks from this device?')) {
      return;
    }
    const all = await offlineVault.getAllOfflineTracks();
    for (const t of all) {
      await offlineVault.removeOfflineTrack(t.id);
    }
    const stats = await offlineVault.getStorageStats();
    setStorageStats(stats);
    showFeedback('Offline cache cleared.');
  };

  const isGuest = userLibrary.isGuest();
  const allUsers = userLibrary.listUsers();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-lg rounded-3xl bg-[#0c0c10] border border-white/15 p-6 sm:p-7 shadow-2xl z-10 flex flex-col gap-6 text-white max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xl border border-white/20 shrink-0"
                style={{ backgroundColor: currentUser.avatarColor || '#8B5CF6' }}
              >
                {currentUser.name.slice(0, 1).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">{currentUser.name}</h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isGuest
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    }`}
                  >
                    {isGuest ? 'GUEST PROFILE' : 'VYBE ACCOUNT'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{currentUser.email}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Alert Toast */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 border animate-in fade-in duration-200 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Tab Navigation: Profile & Backup vs Sign In / Up */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Account & Storage
            </button>
            <button
              onClick={() => setActiveTab('auth')}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'auth'
                  ? 'bg-[#ED5564] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {isGuest ? 'Log In / Register' : 'Switch / New Account'}
            </button>
          </div>

          {/* VIEW 1: Account, Storage & Backup */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Storage Stats Card */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-emerald-400">
                    <HardDrive className="w-4 h-4" />
                    <span>Local Offline Vault (IndexedDB)</span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    {storageStats.totalMB} MB Used
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-2xl font-black text-white font-mono">
                      {storageStats.count}{' '}
                      <span className="text-xs font-normal text-gray-400 font-sans">
                        songs saved offline
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                      Includes binary audio, cover art & synced lyrics
                    </div>
                  </div>

                  {storageStats.count > 0 && (
                    <button
                      onClick={handleClearOfflineCache}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Vault</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Cross-Device Library Backup & Restore (.vybe.json) */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Cross-Device Library Sync (.vybe.json)</span>
                </div>
                <p className="text-xs text-gray-400">
                  Transfer your playlists and liked songs between your Laptop (Electron/Web) and
                  Android smartphone in 1 click with zero cloud requirement.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    onClick={handleExportBackup}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>Export Backup (.vybe.json)</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Import Backup (.vybe.json)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.vybe.json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Profiles on this device */}
              {allUsers.length > 1 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400 px-1">
                    Other Accounts On This Device
                  </div>
                  <div className="space-y-1">
                    {allUsers
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: u.avatarColor }}
                            >
                              {u.name.slice(0, 1)}
                            </div>
                            <span className="text-xs text-gray-200 font-medium">{u.name}</span>
                          </div>
                          <button
                            onClick={() => {
                              userLibrary.switchUser(u.id);
                              setCurrentUser(u);
                              showFeedback(`Switched to ${u.name}`);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/25 transition-colors cursor-pointer"
                          >
                            Switch
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Guest Switching / Logout */}
              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                {!isGuest ? (
                  <button
                    onClick={handleSwitchToGuest}
                    className="text-xs font-mono text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Switch to Guest Profile</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-gray-500">
                    Logged in as Guest Vyber
                  </span>
                )}

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: Sign In / Sign Up Form */}
          {activeTab === 'auth' && (
            <div className="space-y-5">
              <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    authMode === 'login' ? 'bg-white/15 text-white' : 'text-gray-400'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    authMode === 'signup' ? 'bg-white/15 text-white' : 'text-gray-400'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-mono text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sahil / Synth Wave"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ED5564]/50 transition-colors"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@vybe.music"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ED5564]/50 transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#ED5564] hover:bg-[#ED5564]/90 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#ED5564]/20 transition-all cursor-pointer"
                >
                  {authMode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Free Account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In to Vybe</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
