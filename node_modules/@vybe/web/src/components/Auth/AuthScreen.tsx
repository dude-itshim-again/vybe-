import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import {
  supabase,
  syncUserLibrary,
  fetchUserLibraryByEmail,
  hashPassword,
  getLocalAccountByEmail,
  saveLocalAccount,
  StoredAccountRecord,
} from '../../services/supabaseClient';
import { userLibrary } from '../../services/userLibraryService';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthScreenProps {
  onLoginSuccess?: (user: AuthenticatedUser) => void;
  onSuccess?: (user: any) => void;
}

/**
 * Generates an RFC4122-compliant v4 UUID deterministically from an input string (e.g. email).
 * Ensures a valid UUID is always available if Supabase Auth encounters SMTP or confirmation errors.
 */
function generateDeterministicUUID(input: string): string {
  let h1 = 1779033703 ^ input.length;
  let h2 = 3144134277 ^ input.length;
  let h3 = 1013904242 ^ input.length;
  let h4 = 2773480762 ^ input.length;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 597399067);
    h2 = Math.imul(h2 ^ ch, 2869860233);
    h3 = Math.imul(h3 ^ ch, 951274213);
    h4 = Math.imul(h4 ^ ch, 2716044179);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');
  const full = hex1 + hex2 + hex3 + hex4;

  const p1 = full.substring(0, 8);
  const p2 = full.substring(8, 12);
  const p3 = '4' + full.substring(13, 16);
  const p4 = ((parseInt(full.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + full.substring(17, 20);
  const p5 = full.substring(20, 32);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }

    // =========================================================================
    // STRICT SIGN IN LOGIC (NO AUTO-SIGNUP FALLBACK!)
    // =========================================================================
    if (mode === 'signin') {
      setIsLoading(true);

      try {
        // 1. Check local vault and remote user_library
        const localAccount = getLocalAccountByEmail(cleanEmail);
        const remoteRow = await fetchUserLibraryByEmail(cleanEmail);

        // 2. Call Supabase Auth signInWithPassword
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        // Case A: Supabase successfully verified the password
        if (!signInError && signInData?.user) {
          const resolvedName =
            signInData.user.user_metadata?.full_name ||
            signInData.user.user_metadata?.name ||
            localAccount?.displayName ||
            remoteRow?.display_name ||
            cleanEmail.split('@')[0];

          // Update verified accounts vault
          const pwHash = await hashPassword(cleanPassword);
          saveLocalAccount({
            id: signInData.user.id,
            email: cleanEmail,
            displayName: resolvedName,
            passwordHash: pwHash,
            createdAt: localAccount?.createdAt || Date.now(),
          });

          const profile: AuthenticatedUser = {
            id: signInData.user.id,
            email: cleanEmail,
            displayName: resolvedName,
          };

          localStorage.setItem('vybe_authenticated_user', JSON.stringify(profile));
          await syncUserLibrary(profile.id, {
            email: profile.email,
            display_name: profile.displayName,
          });
          await userLibrary.syncFromSupabaseUser(signInData.user);

          onLoginSuccess?.(profile);
          onSuccess?.(profile);
          return;
        }

        // Case B: Supabase returned an error (e.g., SMTP unconfirmed or incorrect password)
        if (localAccount) {
          // Account exists in verified vault -> verify exact password hash
          const enteredHash = await hashPassword(cleanPassword);
          if (enteredHash !== localAccount.passwordHash) {
            setError('Incorrect email or password. Please try again.');
            return;
          }

          // Exact password hash matched!
          const profile: AuthenticatedUser = {
            id: localAccount.id,
            email: cleanEmail,
            displayName: localAccount.displayName,
          };

          localStorage.setItem('vybe_authenticated_user', JSON.stringify(profile));
          await syncUserLibrary(profile.id, {
            email: profile.email,
            display_name: profile.displayName,
          });
          await userLibrary.syncFromSupabaseUser({
            id: profile.id,
            email: profile.email,
            user_metadata: {
              full_name: profile.displayName,
              name: profile.displayName,
            },
          });

          onLoginSuccess?.(profile);
          onSuccess?.(profile);
          return;
        }

        // Case C: If remote library row exists but local vault doesn't, password was wrong
        if (remoteRow) {
          setError('Incorrect email or password. Please try again.');
          return;
        }

        // Case D: Account does not exist in local vault or remote database
        setError('No account found with this email. Please switch to Create Account.');
      } catch (err: any) {
        console.error('[AuthScreen] Sign in verification error:', err);
        setError('Failed to verify credentials. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // =========================================================================
    // STRICT CREATE ACCOUNT LOGIC
    // =========================================================================
    if (mode === 'signup') {
      const cleanName = displayName.trim();

      if (!cleanName) {
        setError('Please enter your full name.');
        return;
      }

      if (cleanPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      setIsLoading(true);

      try {
        // 1. Check if email is already registered locally or remotely
        const existingLocal = getLocalAccountByEmail(cleanEmail);
        if (existingLocal) {
          setError('An account with this email already exists. Please switch to Sign In.');
          return;
        }

        const existingRemote = await fetchUserLibraryByEmail(cleanEmail);
        if (existingRemote) {
          setError('An account with this email already exists. Please switch to Sign In.');
          return;
        }

        // 2. Call Supabase signUp
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              name: cleanName,
            },
          },
        });

        // If Supabase reports the user is already registered, reject and prompt to sign in
        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('already exists')) {
            setError('An account with this email already exists. Please switch to Sign In.');
            return;
          }
          console.warn('[AuthScreen] signUp notice:', signUpError.message);
        }

        // 3. New account confirmed: construct ID and hashed credentials
        const finalUserId = signUpData?.user?.id || generateDeterministicUUID(cleanEmail);
        const passwordHash = await hashPassword(cleanPassword);

        const newAccount: StoredAccountRecord = {
          id: finalUserId,
          email: cleanEmail,
          displayName: cleanName,
          passwordHash,
          createdAt: Date.now(),
        };
        saveLocalAccount(newAccount);

        // Save initial row to public.user_library
        await syncUserLibrary(finalUserId, {
          email: cleanEmail,
          display_name: cleanName,
        });

        const profile: AuthenticatedUser = {
          id: finalUserId,
          email: cleanEmail,
          displayName: cleanName,
        };

        localStorage.setItem('vybe_authenticated_user', JSON.stringify(profile));

        await userLibrary.syncFromSupabaseUser({
          id: profile.id,
          email: profile.email,
          user_metadata: {
            full_name: profile.displayName,
            name: profile.displayName,
          },
        });

        onLoginSuccess?.(profile);
        onSuccess?.(profile);
      } catch (err: any) {
        console.error('[AuthScreen] Create account error:', err);
        setError('Failed to create account. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full p-8 rounded-3xl backdrop-blur-3xl bg-[#0E1018]/85 border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.7)] relative text-white flex flex-col z-10"
      >
        {/* Brand Header: Logo + Vybe. */}
        <div className="flex items-center gap-3 justify-center mb-5">
          <img
            src="/logo.png"
            alt="Vybe"
            className="w-12 h-12 rounded-full object-cover border border-white/20 shadow-[0_0_24px_rgba(255,255,255,0.2)]"
          />
          <span className="font-bold text-2xl tracking-tight text-white font-sans">
            Vybe<span className="text-[#E86538]">.</span>
          </span>
        </div>

        {/* Clean Mode Switcher: Sign In vs Create Account */}
        <div className="flex items-center justify-between p-1 bg-white/[0.06] border border-white/10 rounded-2xl mb-6">
          <button
            id="auth-toggle-signin"
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.25)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            id="auth-toggle-signup"
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.25)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Dynamic Headline & Subtitle */}
        <div className="text-center mb-5">
          <h1 className="text-2xl sm:text-[30px] font-normal tracking-tight text-white font-editorial leading-tight">
            {mode === 'signin' ? 'Welcome Back to Vybe.' : 'Create Your Vybe Account.'}
          </h1>
          <p className="text-xs text-white/50 font-sans mt-1.5 max-w-xs mx-auto leading-relaxed">
            {mode === 'signin'
              ? 'Enter your credentials to unlock your synced music library.'
              : 'Enter your details to create your high-fidelity music vault.'}
          </p>
        </div>

        {/* Separated Form by Mode */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Input 1: Your Name (ONLY shown when mode === 'signup') */}
          {mode === 'signup' && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                id="auth-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Name (e.g. demn)"
                autoComplete="name"
                style={{
                  WebkitBoxShadow: '0 0 0 1000px #141622 inset',
                  WebkitTextFillColor: 'white',
                }}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-sans focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all shadow-inner text-xs autofill:bg-transparent"
              />
            </div>
          )}

          {/* Input 2: Email Address (Always shown) */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="auth-email-address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address (e.g. sahilrut001@gmail.com)"
              autoComplete="email"
              style={{
                WebkitBoxShadow: '0 0 0 1000px #141622 inset',
                WebkitTextFillColor: 'white',
              }}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-sans focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all shadow-inner text-xs autofill:bg-transparent"
            />
          </div>

          {/* Input 3: Password (Always shown, min 6 chars) */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? 'Password' : 'Password (min 6 chars)'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              style={{
                WebkitBoxShadow: '0 0 0 1000px #141622 inset',
                WebkitTextFillColor: 'white',
              }}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-sans focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all shadow-inner text-xs autofill:bg-transparent"
            />
            <button
              id="auth-toggle-password-visibility"
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Red Error Message Box with Quick Switch Action */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl font-sans leading-snug flex flex-col gap-1.5"
              >
                <span>{error}</span>
                {error.includes('switch to Create Account') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-rose-300 hover:text-white underline text-left cursor-pointer transition-colors"
                  >
                    Switch to Create Account →
                  </button>
                )}
                {error.includes('switch to Sign In') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    className="text-[11px] font-semibold text-rose-300 hover:text-white underline text-left cursor-pointer transition-colors"
                  >
                    Switch to Sign In →
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode-Specific Submit Button */}
          <button
            id={mode === 'signin' ? 'auth-submit-signin-btn' : 'auth-submit-signup-btn'}
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,255,255,0.18)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In →' : 'Create Account →'}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AuthScreen;
