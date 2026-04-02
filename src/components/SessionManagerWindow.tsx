'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  FolderOpen,
  Music2,
  Save,
  Upload,
  Download,
  Trash2,
  LogOut,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listSessions,
  saveSession,
  deleteSession,
  importSessionFromString,
  listUserSessions,
  saveUserSession,
  deleteUserSession,
  exportSessionFile,
  type SavedSession,
} from '@/lib/sessions';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface SessionManagerWindowProps {
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  /** Client builds a SavedSession from current audio state */
  onBuildSession: (name: string) => SavedSession;
  /** Client reconstructs audio engine from a saved session */
  onLoad: (session: SavedSession) => void;
  isEngineInitialized: boolean;
}

type SignInMode = 'google' | 'email';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SessionManagerWindow({
  position,
  zIndex,
  onClose,
  onMouseDown,
  onTouchStart,
  onBuildSession,
  onLoad,
  isEngineInitialized,
}: SessionManagerWindowProps) {
  const { user, loading, isConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInMode, setSignInMode] = useState<SignInMode>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from the right backend whenever auth state changes
  const refresh = async () => {
    if (user) {
      try {
        const cloudSessions = await listUserSessions(user.uid);
        setSessions(cloudSessions);
      } catch {
        setSessions([]);
      }
    } else {
      setSessions(listSessions());
    }
  };

  useEffect(() => { refresh(); }, [user]);

  // Show sign-in panel when unauthenticated; hide when authenticated
  useEffect(() => {
    if (!loading && !user) setShowSignIn(true);
    if (user) { setShowSignIn(false); setAuthError(''); }
  }, [user, loading]);

  useEffect(() => {
    if (isSaving) saveInputRef.current?.focus();
  }, [isSaving]);

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;
  const isAuthed = !loading && !!user;

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSaveCommit = async () => {
    const name = saveName.trim();
    if (!name || !user) return;
    const session = onBuildSession(name);
    try {
      await saveUserSession(user.uid, session);
      toast({ title: 'Session saved', description: name });
      setSaveName('');
      setIsSaving(false);
      await refresh();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: String(err) });
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedId || !user) return;
    try {
      await deleteUserSession(user.uid, selectedId);
      setSelectedId(null);
      await refresh();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Delete failed', description: String(err) });
    }
  };

  // ─── Export / Import ───────────────────────────────────────────────────────

  const handleExport = () => {
    if (!selectedSession) return;
    exportSessionFile(selectedSession);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const session = importSessionFromString(text);
      if (user) {
        await saveUserSession(user.uid, session);
      } else {
        saveSession(session);
      }
      toast({ title: 'Session imported', description: session.name });
      await refresh();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Import failed', description: err instanceof Error ? err.message : String(err) });
    }
    e.target.value = '';
  };

  // ─── Auth ──────────────────────────────────────────────────────────────────

  // Maps Firebase error codes to readable messages.
  // setShowSignIn(false) is intentionally NOT called here —
  // the useEffect watching `user` handles the view transition once
  // onAuthStateChanged confirms a real sign-in.
  const authErrorMessage = (err: unknown): string => {
    const code = (err as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/invalid-email':          return 'Please enter a valid email address.';
      case 'auth/email-already-in-use':   return 'An account with this email already exists.';
      case 'auth/weak-password':          return 'Password must be at least 6 characters.';
      case 'auth/user-not-found':         return 'No account found with this email.';
      case 'auth/wrong-password':         return 'Incorrect password.';
      case 'auth/invalid-credential':     return 'Incorrect email or password.';
      case 'auth/too-many-requests':      return 'Too many attempts. Please try again later.';
      case 'auth/popup-closed-by-user':   return 'Sign-in cancelled.';
      case 'auth/popup-blocked':          return 'Pop-up blocked — please allow pop-ups for this site.';
      default:                            return 'Authentication failed. Please try again.';
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
    if (!email.trim()) { setAuthError('Please enter your email address.'); return; }
    if (!password)      { setAuthError('Please enter your password.'); return; }

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
    if (!email.trim())        { setAuthError('Please enter an email address.'); return; }
    if (!email.includes('@')) { setAuthError('Please enter a valid email address.'); return; }
    if (!password)            { setAuthError('Please enter a password.'); return; }
    if (password.length < 6)  { setAuthError('Password must be at least 6 characters.'); return; }

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

  const handleSignOut = async () => {
    await signOut();
    setSessions(listSessions());
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 w-full h-dvh bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans flex flex-col select-none'
          : 'bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none flex flex-col'
      }
      style={isMobile ? { zIndex } : { left: `${position.x}px`, top: `${position.y}px`, zIndex, width: 'min(440px, calc(100vw - 1rem))' }}
    >
      {/* Title bar */}
      <div
        className={`bg-blue-800 text-white flex items-center justify-between p-1 shrink-0 ${isMobile ? '' : 'cursor-move'}`}
        onMouseDown={isMobile ? undefined : onMouseDown}
        onTouchStart={isMobile ? undefined : onTouchStart}
      >
        <div className="flex items-center gap-1">
          <FolderOpen className="w-4 h-4" />
          <span className="font-bold text-sm">Sessions.exe</span>
        </div>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* ── Sign-in panel ─────────────────────────────────────────────────── */}
      {showSignIn && !isAuthed && (
        <div
          className="flex flex-col gap-3 p-4 overflow-y-auto shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <LogIn className="w-4 h-4" />
              Sign in to save sessions
            </div>
            {/* Allow dismissing — user can still browse/load local sessions */}
            <button
              className="text-xs text-neutral-500 hover:text-black underline"
              onClick={() => setShowSignIn(false)}
            >
              Skip
            </button>
          </div>

          <p className="text-xs text-neutral-700">
            Sessions sync across devices and are private to your account.
          </p>

          {!isConfigured && (
            <p className="text-xs text-red-700 border border-red-300 bg-red-50 px-2 py-1.5">
              Firebase is not configured. Add your API keys to <code>.env.local</code> to enable sign-in.
            </p>
          )}

          {signInMode === 'google' ? (
            <Button
              variant="retro"
              className="w-full h-8 text-xs text-black flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={authLoading || !isConfigured}
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </Button>
          ) : forgotPassword ? (
            <div className="flex flex-col gap-2">
              {resetSent ? (
                <p className="text-xs text-green-700 border border-green-300 bg-green-50 px-2 py-1.5">
                  Reset email sent. Check your inbox.
                </p>
              ) : (
                <>
                  <p className="text-xs text-neutral-600">Enter your email and we'll send a reset link.</p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                    className="w-full text-xs border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white px-2 py-1.5 outline-none bg-white text-black"
                  />
                  <Button
                    variant="retro"
                    className="w-full h-7 text-xs text-black"
                    onClick={handleResetPassword}
                    disabled={authLoading || !isConfigured}
                  >
                    Send Reset Email
                  </Button>
                </>
              )}
              <button
                className="text-xs text-blue-700 underline hover:text-blue-900 text-left"
                onClick={() => { setForgotPassword(false); setResetSent(false); setAuthError(''); }}
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white px-2 py-1.5 outline-none bg-white text-black"
              />
              <div className="flex border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
                  className="flex-1 text-xs px-2 py-1.5 outline-none bg-transparent text-black"
                />
                <button
                  type="button"
                  className="px-2 text-neutral-500 hover:text-black text-xs shrink-0"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="retro"
                  className="flex-1 h-7 text-xs text-black"
                  onClick={handleEmailSignIn}
                  disabled={authLoading || !isConfigured}
                >
                  Sign In
                </Button>
                <Button
                  variant="retro"
                  className="flex-1 h-7 text-xs text-black"
                  onClick={handleEmailSignUp}
                  disabled={authLoading || !isConfigured}
                >
                  Create Account
                </Button>
              </div>
              <button
                className="text-xs text-blue-700 underline hover:text-blue-900 text-left"
                onClick={() => { setForgotPassword(true); setAuthError(''); }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {!forgotPassword && (
            <button
              className="text-xs text-blue-700 underline hover:text-blue-900 text-left"
              onClick={() => { setSignInMode(signInMode === 'google' ? 'email' : 'google'); setAuthError(''); setForgotPassword(false); setResetSent(false); }}
            >
              {signInMode === 'google' ? 'Sign in with email instead' : 'Sign in with Google instead'}
            </button>
          )}

          {authError && (
            <p className="text-xs text-red-700">{authError}</p>
          )}

          <div className="border-t border-neutral-300 pt-2 text-xs text-neutral-500">
            Your email is used only for account access. Sessions are private to your account.{' '}
            You can still load and export sessions without signing in.
          </div>
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1 p-1 border-t border-b border-neutral-400 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <Button
          variant="retro"
          size="sm"
          className="h-6 text-xs px-2 flex items-center gap-1 text-black"
          disabled={!isAuthed || !isEngineInitialized}
          onClick={() => { setIsSaving(true); setSaveName(`Session ${new Date().toLocaleDateString()}`); }}
        >
          <Save className="w-3 h-3" />
          Save As…
        </Button>
        <Button
          variant="retro"
          size="sm"
          className="h-6 text-xs px-2 flex items-center gap-1 text-black"
          disabled={!selectedSession}
          onClick={() => { if (selectedSession) onLoad(selectedSession); }}
        >
          <FolderOpen className="w-3 h-3" />
          Load
        </Button>
        <Button
          variant="retro"
          size="sm"
          className="h-6 text-xs px-2 flex items-center gap-1 text-black"
          disabled={!isAuthed || !selectedSession}
          onClick={handleDelete}
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </Button>
        <div className="flex-grow" />
        <Button
          variant="retro"
          size="sm"
          className="h-6 text-xs px-2 flex items-center gap-1 text-black"
          disabled={!selectedSession}
          onClick={handleExport}
        >
          <Download className="w-3 h-3" />
          Export
        </Button>
        <Button
          variant="retro"
          size="sm"
          className="h-6 text-xs px-2 flex items-center gap-1 text-black"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3 h-3" />
          Import
        </Button>
      </div>

      {/* ── Session list ──────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col overflow-hidden ${isMobile ? 'flex-1 min-h-0' : ''}`}
        style={isMobile ? undefined : { minHeight: '160px', maxHeight: '40vh' }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Column headers */}
        <div className="flex shrink-0 border-b border-neutral-400 text-xs font-medium bg-silver text-black">
          <div className="flex-grow px-2 py-0.5 border-r border-neutral-400">Name</div>
          <div className="w-24 shrink-0 px-2 py-0.5 border-r border-neutral-400 hidden sm:block">Saved</div>
          <div className="w-12 shrink-0 px-2 py-0.5 text-right">Layers</div>
        </div>

        {/* Inline save-name row */}
        {isSaving && (
          <div className="flex shrink-0 items-center border-b border-neutral-300 bg-white">
            <div className="flex items-center gap-1 flex-grow px-1">
              <Music2 className="w-3 h-3 text-neutral-500 shrink-0" />
              <input
                ref={saveInputRef}
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCommit();
                  if (e.key === 'Escape') setIsSaving(false);
                }}
                className="flex-grow text-xs border border-blue-600 outline-none px-1 py-0.5 text-black"
                placeholder="Session name…"
              />
            </div>
            <button className="text-xs px-2 py-0.5 border-l border-neutral-300 hover:bg-neutral-200 text-black" onClick={handleSaveCommit}>OK</button>
            <button className="text-xs px-2 py-0.5 border-l border-neutral-300 hover:bg-neutral-200 text-black" onClick={() => setIsSaving(false)}>✕</button>
          </div>
        )}

        {/* Session rows */}
        <div className="flex-grow overflow-y-auto min-h-0">
          {sessions.length === 0 && !isSaving && (
            <div className="flex items-center justify-center h-full text-xs text-neutral-700 italic p-4">
              {isAuthed ? 'No saved sessions' : 'Sign in to see cloud sessions, or import a .json file'}
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center text-xs cursor-pointer ${
                selectedId === s.id ? 'bg-blue-700 text-white' : 'hover:bg-blue-100 text-black'
              }`}
              onClick={() => setSelectedId(s.id)}
              onDoubleClick={() => { setSelectedId(s.id); onLoad(s); }}
            >
              <div className="flex items-center gap-1 flex-grow px-2 py-1 truncate min-w-0">
                <Music2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{s.name}</span>
              </div>
              <div className="w-24 shrink-0 px-2 py-1 truncate hidden sm:block">{formatDate(s.updatedAt)}</div>
              <div className="w-12 shrink-0 px-2 py-1 text-right">{s.layers.length}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div
        className="border-t border-neutral-400 px-2 py-0.5 text-xs text-black flex items-center justify-between shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <span className="truncate mr-2">
          {selectedSession
            ? `${selectedSession.name} — ${selectedSession.layers.length} layer${selectedSession.layers.length !== 1 ? 's' : ''}`
            : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        </span>
        {isAuthed ? (
          showSignOutConfirm ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-black">Sign out?</span>
              <button
                className="text-xs px-1.5 py-0.5 border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver hover:bg-neutral-200"
                onClick={() => setShowSignOutConfirm(false)}
              >No</button>
              <button
                className="text-xs px-1.5 py-0.5 border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver hover:bg-neutral-200"
                onClick={handleSignOut}
              >Yes</button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-neutral-700 hover:text-black shrink-0"
              onClick={() => setShowSignOutConfirm(true)}
            >
              <LogOut className="w-3 h-3" />
              <span className="max-w-[120px] truncate">{user?.displayName ?? user?.email ?? 'Sign out'}</span>
            </button>
          )
        ) : (
          <button
            className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 shrink-0"
            onClick={() => setShowSignIn(true)}
          >
            <LogIn className="w-3 h-3" />
            Sign in
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
    </div>
  );
}
