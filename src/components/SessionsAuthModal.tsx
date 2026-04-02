'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

type AuthMethod = 'google' | 'email';
type EmailFlow = 'signin' | 'signup';

type SessionsAuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful sign-in while the modal was open (e.g. open Sessions.exe). */
  onSignedIn?: () => void;
};

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up blocked — please allow pop-ups for this site.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

export default function SessionsAuthModal({
  open,
  onOpenChange,
  onSignedIn,
}: SessionsAuthModalProps) {
  const {
    user,
    isConfigured,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('google');
  const [emailFlow, setEmailFlow] = useState<EmailFlow>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    if (open && user) {
      const display = user.displayName || user.email || 'Account';
      toast({
        title: 'Signed in',
        description: `Welcome back, ${display}. Cloud sessions are ready.`,
        duration: 5000,
      });
      onSignedInRef.current?.();
      onOpenChange(false);
      setAuthError('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [open, user, onOpenChange, toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setAuthError('');
      setAuthMethod('google');
      setEmailFlow('signin');
      setConfirmPassword('');
      setShowPassword(false);
      setForgotPassword(false);
      setResetSent(false);
    }
  }, [open]);

  const handleResetPassword = async () => {
    if (!email.trim()) { setAuthError('Please enter your email address first.'); return; }
    setAuthLoading(true);
    setAuthError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim()) {
      setAuthError('Please enter an email address.');
      return;
    }
    if (!email.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await signUpWithEmail(email, password);
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-default border-0 p-0 w-full"
        aria-label="Close sign-in dialog"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-auth-title"
        className="relative z-10 w-full max-w-sm bg-silver border-2 border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 shadow-2xl font-sans text-left max-h-[min(85dvh,560px)] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-800 text-white flex items-center justify-between px-1.5 py-1 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <LogIn className="w-4 h-4 shrink-0" />
            <span id="session-auth-title" className="font-bold text-sm truncate">
              Sign in to Concrete 95
            </span>
          </div>
          <Button
            variant="retro"
            size="icon"
            className="w-5 h-5 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="w-3 h-3 text-black" />
          </Button>
        </div>
        <div className="p-4 flex flex-col gap-3 overflow-y-auto min-h-0">
          <p className="text-xs text-neutral-800">
            Sign in to open Sessions and sync across devices. Sessions stay private to your account.
          </p>

          {!isConfigured && (
            <p className="text-xs text-red-700 border border-red-400 bg-red-50 px-2 py-1.5">
              Firebase is not configured. Add your API keys to <code>.env.local</code>.
            </p>
          )}

          {authMethod === 'email' && !forgotPassword && (
            <button
              type="button"
              className="text-xs text-blue-800 underline hover:text-blue-950 text-center"
              onClick={() => {
                setAuthMethod('google');
                setAuthError('');
                setEmailFlow('signin');
                setConfirmPassword('');
              }}
            >
              Use Google instead
            </button>
          )}

          {authMethod === 'google' && (
            <>
            <Button
              variant="retro"
              className="w-full h-9 text-xs text-black flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={authLoading || !isConfigured}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
            <button
              type="button"
              className="text-xs text-blue-800 underline hover:text-blue-950 text-center"
              onClick={() => { setAuthMethod('email'); setAuthError(''); }}
            >
              Use email instead
            </button>
            </>
          )}

          {authMethod === 'email' && (
            forgotPassword ? (
              <div className="w-full flex flex-col gap-2">
                {resetSent ? (
                  <p className="text-xs text-green-700 border border-green-300 bg-green-50 px-2 py-1.5">
                    Reset email sent — check your inbox.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-neutral-600">Enter your email and we'll send a password reset link.</p>
                    <input
                      type="email"
                      placeholder="Email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(); }}
                      className="w-full text-xs border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white px-1.5 py-1.5 outline-none bg-white text-black"
                    />
                    <Button
                      variant="retro"
                      className="w-full h-9 text-xs text-black"
                      onClick={handleResetPassword}
                      disabled={authLoading || !isConfigured}
                    >
                      Send Reset Email
                    </Button>
                  </>
                )}
                <button
                  type="button"
                  className="text-xs text-blue-800 underline hover:text-blue-950 text-left"
                  onClick={() => { setForgotPassword(false); setResetSent(false); setAuthError(''); }}
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2">
                <div
                  className="flex p-0.5 bg-neutral-300 border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white gap-0.5"
                  role="tablist"
                  aria-label="Email account"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={emailFlow === 'signin'}
                    className={`flex-1 h-7 text-xs font-medium transition-colors ${
                      emailFlow === 'signin'
                        ? 'bg-silver text-black border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 shadow-sm'
                        : 'text-neutral-700 hover:bg-white/40'
                    }`}
                    onClick={() => { setEmailFlow('signin'); setAuthError(''); setConfirmPassword(''); }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={emailFlow === 'signup'}
                    className={`flex-1 h-7 text-xs font-medium transition-colors ${
                      emailFlow === 'signup'
                        ? 'bg-silver text-black border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 shadow-sm'
                        : 'text-neutral-700 hover:bg-white/40'
                    }`}
                    onClick={() => { setEmailFlow('signup'); setAuthError(''); setConfirmPassword(''); }}
                  >
                    Create account
                  </button>
                </div>

                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white px-1.5 py-1.5 outline-none bg-white text-black"
                />

                <div className="flex border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white bg-white">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={emailFlow === 'signup' ? 'Password (6+ characters)' : 'Password'}
                    autoComplete={emailFlow === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (emailFlow === 'signin') handleEmailSignIn();
                    }}
                    className="flex-1 text-xs px-1.5 py-1.5 outline-none bg-transparent text-black"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="px-2 text-xs text-neutral-500 hover:text-black shrink-0"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {emailFlow === 'signup' && (
                  <input
                    type="password"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSignUp(); }}
                    className="w-full text-xs border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white px-1.5 py-1.5 outline-none bg-white text-black"
                  />
                )}

                <Button
                  variant="retro"
                  className="w-full h-9 text-xs text-black"
                  onClick={emailFlow === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                  disabled={authLoading}
                >
                  {emailFlow === 'signin' ? 'Sign in with email' : 'Create account'}
                </Button>

                {emailFlow === 'signin' && (
                  <button
                    type="button"
                    className="text-xs text-blue-800 underline hover:text-blue-950 text-left"
                    onClick={() => { setForgotPassword(true); setAuthError(''); }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )
          )}

          {authError && <p className="text-xs text-red-700 text-center">{authError}</p>}

          <p className="text-xs text-neutral-500 border-t border-neutral-300 pt-2">
            Your email is used only for account access. Sessions are private to your account.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
