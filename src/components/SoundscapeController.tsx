'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LogIn,
  LogOut,
  Music,
  Music2,
  Save,
  Sparkles,
  Square,
  Trash2,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  deleteUserSession,
  listUserSessions,
  saveUserSession,
  type SavedSession,
} from '@/lib/sessions';

interface SoundscapeControllerProps {
  onAddSynthLayer: () => void;
  onAddFreesoundLayer: () => void;
  onAddGrainLayer: () => void;
  onAddMelodicLayer: () => void;
  onAddAtmosphereLayer: () => void;
  onStopAll: () => void;
  canAddLayer: boolean;
  hasLayers: boolean;
  isEngineInitialized: boolean;
  onBuildSession: (name: string) => SavedSession;
  onLoadSession: (session: SavedSession) => void;
  /** Opens the sign-in modal (managed by parent) */
  onSignIn: () => void;
  activeSession: SavedSession | null;
  isSessionDirty: boolean;
  onSaveChanges: () => Promise<void>;
  onEndSession: () => void;
  /** When set to true, programmatically opens the Start menu */
  openMenu?: boolean;
}

type MenuView = 'main' | 'sessions';

const StartIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 20 20'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path d='M2 2H9V9H2V2Z' fill='black' />
    <path d='M11 2H18V9H11V2Z' fill='black' />
    <path d='M2 11H9V18H2V11Z' fill='black' />
    <path d='M11 11H18V18H11V11Z' fill='black' />
  </svg>
);

const menuItemClass =
  'w-full justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white disabled:hover:bg-transparent disabled:text-neutral-500 text-black';

export default function SoundscapeController({
  onAddSynthLayer,
  onAddFreesoundLayer,
  onAddGrainLayer,
  onAddMelodicLayer,
  onAddAtmosphereLayer,
  onStopAll,
  canAddLayer,
  hasLayers,
  isEngineInitialized,
  onBuildSession,
  onLoadSession,
  onSignIn,
  activeSession,
  isSessionDirty,
  onSaveChanges,
  onEndSession,
  openMenu,
}: SoundscapeControllerProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);


  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (openMenu) setIsOpen(true); }, [openMenu]);

  // Dismiss the end-confirm when the session is cleared externally
  useEffect(() => {
    if (!activeSession) setShowEndConfirm(false);
  }, [activeSession]);

  // Reset state whenever the menu closes
  useEffect(() => {
    if (!isOpen) {
      setMenuView('main');
      setDeletingId(null);
      setShowSaveInput(false);
      setSaveName('');
    }
  }, [isOpen]);

  // Focus the save name input when it mounts
  useEffect(() => {
    if (showSaveInput) saveInputRef.current?.focus();
  }, [showSaveInput]);

  const refreshSessions = async () => {
    if (!user) return;
    try {
      setSessions(await listUserSessions(user.uid));
    } catch {
      setSessions([]);
    }
  };

  // Fetch sessions whenever the submenu opens or the user changes
  useEffect(() => {
    if (menuView === 'sessions') refreshSessions();
  }, [menuView, user]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const close = () => setIsOpen(false);

  const handleAddSynthLayer = () => {
    onAddSynthLayer();
    close();
  };
  const handleAddFreesoundLayer = () => {
    onAddFreesoundLayer();
    close();
  };
  const handleAddGrainLayer = () => {
    onAddGrainLayer();
    close();
  };
  const handleAddMelodicLayer = () => {
    onAddMelodicLayer();
    close();
  };
  const handleAddAtmosphereLayer = () => {
    onAddAtmosphereLayer();
    close();
  };
  const handleStopAll = () => {
    onStopAll();
    close();
  };

  const handleLoadSession = (s: SavedSession) => {
    onLoadSession(s);
    close();
  };

  const handleDeleteRequest = (id: string) => setDeletingId(id);

  const handleDeleteConfirm = async (id: string) => {
    if (!user) return;
    try {
      await deleteUserSession(user.uid, id);
      toast({ title: 'Session deleted' });
      await refreshSessions();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: String(err),
      });
    }
    setDeletingId(null);
  };

  const handleSaveCommit = async () => {
    const name = saveName.trim();
    if (!name || !user) return;
    setIsSaving(true);
    try {
      const session = onBuildSession(name);
      await saveUserSession(user.uid, session);
      toast({ title: 'Session saved', description: name });
      setSaveName('');
      setShowSaveInput(false);
      await refreshSessions();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: String(err),
      });
    }
    setIsSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    close();
  };
  const handleSignIn = () => {
    close();
    onSignIn();
  };

  // On desktop, hovering a non-sessions item closes the sessions flyout
  const closeSubmenu = () => {
    if (!isMobile) setMenuView('main');
  };
  // On desktop, hovering Sessions opens the flyout
  const openSubmenu = () => {
    if (!isMobile) setMenuView('sessions');
  };

  // ── Shared sessions panel content ─────────────────────────────────────────
  // Rendered both in mobile drill-down view and desktop flyout

  const renderSessionsPanel = () => (
    <div className='flex flex-col text-black w-56'>
      {/* Back header — mobile only */}
      {isMobile && (
        <button
          className='flex items-center gap-1 px-2 py-1.5 text-xs font-bold bg-blue-800 text-white hover:bg-blue-900 w-full text-left'
          onClick={() => setMenuView('main')}
        >
          <ChevronLeft className='w-3 h-3 shrink-0' />
          Sessions
        </button>
      )}

      {/* Desktop flyout title bar */}
      {!isMobile && (
        <div className='px-2 py-1 bg-neutral-200 border-b border-neutral-400 text-xs font-bold text-black select-none'>
          Sessions
        </div>
      )}

      {/* Session rows */}
      <div
        className='flex flex-col overflow-y-auto'
        style={{ maxHeight: '40vh' }}
      >
        {sessions.length === 0 ? (
          <p className='text-xs text-neutral-600 italic px-3 py-2'>
            No saved sessions
          </p>
        ) : (
          sessions.map((s) =>
            deletingId === s.id ? (
              <div
                key={s.id}
                className='flex items-center border-b border-neutral-200 bg-red-50'
              >
                <span className='flex-grow text-xs text-red-700 px-2 py-1 truncate'>
                  Delete &ldquo;{s.name}&rdquo;?
                </span>
                <button
                  className='text-xs px-2 py-1 bg-red-700 text-white hover:bg-red-800 shrink-0'
                  onClick={() => handleDeleteConfirm(s.id)}
                >
                  Yes
                </button>
                <button
                  className='text-xs px-2 py-1 hover:bg-neutral-200 shrink-0'
                  onClick={() => setDeletingId(null)}
                >
                  No
                </button>
              </div>
            ) : (
              <div
                key={s.id}
                className='flex items-center border-b border-neutral-200 group hover:bg-blue-800 hover:text-white'
              >
                <button
                  className='flex items-center gap-1.5 flex-grow px-2 py-1 text-xs text-left'
                  onClick={() => handleLoadSession(s)}
                >
                  <Music2 className='w-3 h-3 shrink-0' />
                  <span className='truncate'>{s.name}</span>
                </button>
                <button
                  className='px-2 py-1 opacity-30 group-hover:opacity-80 hover:!text-red-300 shrink-0'
                  title={`Delete "${s.name}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(s.id);
                  }}
                >
                  <Trash2 className='w-3 h-3' />
                </button>
              </div>
            ),
          )
        )}
      </div>

      <Separator className='bg-neutral-400' />

      {/* Save CTA */}
      {showSaveInput ? (
        <div className='flex items-center gap-1 p-1'>
          <input
            ref={saveInputRef}
            type='text'
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveCommit();
              if (e.key === 'Escape' && !isSaving) setShowSaveInput(false);
            }}
            placeholder='Session name…'
            disabled={isSaving}
            className='flex-grow text-xs border border-blue-600 outline-none px-1.5 py-0.5 text-black bg-white min-w-0 disabled:opacity-50'
          />
          <button
            className='text-xs px-2 py-0.5 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 flex items-center gap-1'
            onClick={handleSaveCommit}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <svg
                  className='w-3 h-3 animate-spin'
                  viewBox='0 0 24 24'
                  fill='none'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z'
                  />
                </svg>
                Saving…
              </>
            ) : (
              'OK'
            )}
          </button>
          <button
            className='text-xs px-2 py-0.5 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed shrink-0'
            onClick={() => setShowSaveInput(false)}
            disabled={isSaving}
          >
            ✕
          </button>
        </div>
      ) : (
        <Button
          variant='ghost'
          className={`${menuItemClass} text-xs`}
          disabled={!isEngineInitialized || !hasLayers}
          onClick={() => {
            setSaveName(`Session ${new Date().toLocaleDateString()}`);
            setShowSaveInput(true);
          }}
        >
          <Save className='h-3.5 w-3.5 shrink-0' /> Save Current Session
        </Button>
      )}
    </div>
  );

  const handleSaveChangesClick = async () => {
    setIsSavingChanges(true);
    try {
      await onSaveChanges();
    } finally {
      setIsSavingChanges(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className='z-10 relative'>
      {/* Session info panel — floats above Start button when a session is active */}
      {activeSession && (
        <div className='absolute bottom-full left-0 mb-1 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 text-black text-xs w-56 select-none'>
          {/* Title bar */}
          <div className='bg-blue-800 text-white flex items-center px-2 py-0.5 gap-1'>
            <span className='font-bold text-xs flex-grow truncate'>
              {activeSession.name}
            </span>
            <button
              className='shrink-0 w-4 h-4 bg-silver text-black flex items-center justify-center border border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 hover:brightness-110 leading-none font-bold text-[10px]'
              title='End session'
              onClick={() =>
                isSessionDirty && user
                  ? setShowEndConfirm(true)
                  : onEndSession()
              }
            >
              ✕
            </button>
          </div>

          {/* Confirm end — shown instead of body when dirty and X was clicked */}
          {showEndConfirm ? (
            <div className='px-2 py-2 flex flex-col gap-2'>
              <p className='text-xs text-red-700 font-bold'>
                End session without saving?
              </p>
              <p className='text-xs text-neutral-600'>
                Unsaved changes will be lost.
              </p>
              <div className='flex gap-1 justify-end'>
                <button
                  className='text-xs px-2 py-0.5 bg-red-700 text-white hover:bg-red-800'
                  onClick={onEndSession}
                >
                  End Session
                </button>
                <button
                  className='text-xs px-2 py-0.5 hover:bg-neutral-200'
                  onClick={() => setShowEndConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className='px-2 py-1 text-neutral-600'>
                <span>
                  Saved:{' '}
                  {new Date(activeSession.updatedAt).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric', year: 'numeric' },
                  )}
                </span>
              </div>
              {isSessionDirty && user && (
                <>
                  <div className='h-px bg-neutral-400' />
                  <div className='px-2 py-1 flex items-center gap-2'>
                    <span className='flex-grow text-orange-700 font-bold text-xs'>
                      Unsaved changes
                    </span>
                    <button
                      className='text-xs px-2 py-0.5 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 shrink-0'
                      onClick={handleSaveChangesClick}
                      disabled={isSavingChanges}
                    >
                      {isSavingChanges ? (
                        <>
                          <svg
                            className='w-3 h-3 animate-spin'
                            viewBox='0 0 24 24'
                            fill='none'
                          >
                            <circle
                              className='opacity-25'
                              cx='12'
                              cy='12'
                              r='10'
                              stroke='currentColor'
                              strokeWidth='4'
                            />
                            <path
                              className='opacity-75'
                              fill='currentColor'
                              d='M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z'
                            />
                          </svg>
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className='w-3 h-3' />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant='start' size='sm' className='h-8'>
            <StartIcon />
            <span className='font-bold'>Start</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className='w-auto p-0 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 !rounded-none overflow-visible relative'
          side='top'
          align='start'
          sideOffset={0}
        >
          <div className='flex'>
            {/* ── Sidebar stripe ────────────────────────────────────────── */}
            <div
              className='w-8 flex items-center justify-center bg-neutral-500 text-white font-bold text-lg p-2 select-none shrink-0'
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              <span className='tracking-widest rotate-180'>Concrete 95</span>
            </div>

            {/* ── Main panel ────────────────────────────────────────────── */}
            {/* Mobile: hidden when drilling into sessions. Desktop: always shown. */}
            {(!isMobile || menuView === 'main') && (
              <div className='flex flex-col gap-1 text-black p-1 w-max'>
                <Button
                  variant='ghost'
                  className={`${menuItemClass} group`}
                  onClick={handleAddFreesoundLayer}
                  disabled={!canAddLayer}
                  onMouseEnter={closeSubmenu}
                >
                  <Waves className='h-4 w-4 shrink-0' />
                  <div className='flex flex-col items-start'>
                    <span>Add Sample Loop</span>
                    <span className='text-[10px] text-neutral-600 group-hover:text-blue-200 font-normal leading-tight'>
                      Ambient field recordings from Freesound
                    </span>
                  </div>
                </Button>
                <Button
                  variant='ghost'
                  className={`${menuItemClass} group`}
                  onClick={handleAddGrainLayer}
                  disabled={!canAddLayer}
                  onMouseEnter={closeSubmenu}
                >
                  <Sparkles className='h-4 w-4 shrink-0' />
                  <div className='flex flex-col items-start'>
                    <span>Add Grain Texture</span>
                    <span className='text-[10px] text-neutral-600 group-hover:text-blue-200 font-normal leading-tight'>
                      Granular time-stretch of a Freesound sample
                    </span>
                  </div>
                </Button>
                <Button
                  variant='ghost'
                  className={`${menuItemClass} group`}
                  onClick={handleAddSynthLayer}
                  disabled={!canAddLayer}
                  onMouseEnter={closeSubmenu}
                >
                  <Zap className='h-4 w-4 shrink-0' />
                  <div className='flex flex-col items-start'>
                    <span>Add Synth Pad</span>
                    <span className='text-[10px] text-neutral-600 group-hover:text-blue-200 font-normal leading-tight'>
                      Generative harmonic pad layer
                    </span>
                  </div>
                </Button>
                <Button
                  variant='ghost'
                  className={`${menuItemClass} group`}
                  onClick={handleAddMelodicLayer}
                  disabled={!canAddLayer}
                  onMouseEnter={closeSubmenu}
                >
                  <Music className='h-4 w-4 shrink-0' />
                  <div className='flex flex-col items-start'>
                    <span>Add Melodic Loop</span>
                    <span className='text-[10px] text-neutral-600 group-hover:text-blue-200 font-normal leading-tight'>
                      Sparse phrases, bell or glass tones
                    </span>
                  </div>
                </Button>
                <Button
                  variant='ghost'
                  className={`${menuItemClass} group`}
                  onClick={handleAddAtmosphereLayer}
                  disabled={!canAddLayer}
                  onMouseEnter={closeSubmenu}
                >
                  <Wind className='h-4 w-4 shrink-0' />
                  <div className='flex flex-col items-start'>
                    <span>Add Atmosphere</span>
                    <span className='text-[10px] text-neutral-600 group-hover:text-blue-200 font-normal leading-tight'>
                      Pink/brown noise with slow filter sweep
                    </span>
                  </div>
                </Button>

                <Separator className='bg-neutral-400 my-1' />

                {/* Sessions — only shown to authenticated users */}
                {user && (
                  // relative wrapper so the desktop flyout anchors to this row
                  <div className='relative'>
                    <Button
                      variant='ghost'
                      className={`${menuItemClass} flex items-center ${
                        menuView === 'sessions' && !isMobile
                          ? 'bg-blue-800 text-white'
                          : ''
                      }`}
                      onMouseEnter={openSubmenu}
                      onClick={() => isMobile && setMenuView('sessions')}
                    >
                      <FolderOpen className='h-4 w-4 shrink-0' />
                      <span className='flex-grow text-left'>Sessions</span>
                      <ChevronRight className='h-3 w-3 shrink-0 ml-auto' />
                    </Button>

                    {/* Desktop flyout — top-0 aligns with this row's top edge */}
                    {!isMobile && menuView === 'sessions' && (
                      <div className='absolute top-0 left-full bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 z-50'>
                        {renderSessionsPanel()}
                      </div>
                    )}
                  </div>
                )}

                {/* Auth */}
                {user ? (
                  showSignOutConfirm ? (
                    <div className='px-2 py-1.5 text-xs flex flex-col gap-1.5'>
                      <p className='text-black'>Sign out?</p>
                      <div className='flex gap-1'>
                        <button
                          className='flex-1 text-xs px-2 py-0.5 border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver hover:bg-neutral-200 active:border-t-neutral-500 active:border-l-neutral-500 active:border-r-white active:border-b-white'
                          onClick={() => setShowSignOutConfirm(false)}
                        >
                          No
                        </button>
                        <button
                          className='flex-1 text-xs px-2 py-0.5 border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver hover:bg-neutral-200 active:border-t-neutral-500 active:border-l-neutral-500 active:border-r-white active:border-b-white'
                          onClick={handleSignOut}
                        >
                          Yes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant='ghost'
                      className={menuItemClass}
                      onClick={() => setShowSignOutConfirm(true)}
                      onMouseEnter={closeSubmenu}
                    >
                      <LogOut className='h-4 w-4 shrink-0' />
                      <span className='truncate max-w-[140px]'>
                        {user.displayName ?? user.email ?? 'Sign out'}
                      </span>
                    </Button>
                  )
                ) : (
                  <Button
                    variant='ghost'
                    className={menuItemClass}
                    onClick={handleSignIn}
                    onMouseEnter={closeSubmenu}
                  >
                    <LogIn className='h-4 w-4 shrink-0' /> Sign In
                  </Button>
                )}

                <Separator className='bg-neutral-400 my-1' />

                <Button
                  variant='ghost'
                  className={menuItemClass}
                  onClick={() => { handleStopAll(); }}
                  disabled={!hasLayers}
                  onMouseEnter={closeSubmenu}
                >
                  <Square className='h-4 w-4 shrink-0' /> Stop All
                </Button>
              </div>
            )}

            {/* ── Sessions panel — mobile only (inline drill-down) ─────── */}
            {isMobile && menuView === 'sessions' && (
              <div>{renderSessionsPanel()}</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
