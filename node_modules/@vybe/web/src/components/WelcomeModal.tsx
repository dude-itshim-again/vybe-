import React, { useEffect, useState } from 'react';

interface WelcomeModalProps {
  userId: string;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const hasSeen = localStorage.getItem(`vybe_welcome_shown_${userId}`);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [userId]);

  const handleClose = () => {
    if (userId) {
      localStorage.setItem(`vybe_welcome_shown_${userId}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141622]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome to Vybe.</h2>
        
        <p className="text-white/80 text-sm mb-3 leading-relaxed">
          This beautiful, free music platform was built by <span className="text-white font-semibold">Sahil</span>. You should thank him! 
        </p>

        <div className="mb-4 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/90 font-medium">
          <span>Follow</span>
          <span className="text-[#E86538] font-semibold">@damn_rut</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-6 text-xs text-white/60">
          <strong>Small Note:</strong> Many songs use dynamic lyrics, but some might not be perfectly synced yet. Sorry about that!
        </div>

        <button 
          type="button"
          onClick={handleClose}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Let's Listen →
        </button>
      </div>
    </div>
  );
};

export default WelcomeModal;
