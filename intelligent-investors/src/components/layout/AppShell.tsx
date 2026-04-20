import * as React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { NavBar } from './NavBar';
import { ModeSelector } from './ModeSelector';
import { LearnToggle } from '../learn/LearnToggle';
import { Modal } from '../ui/Modal';

export function AppShell() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: workspaceLoading, updateMode, initializeProfile } = useWorkspace();
  const [showModeSelector, setShowModeSelector] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceLoading && user && !profile) {
      initializeProfile({});
    }
  }, [workspaceLoading, user, profile]);

  if (authLoading || workspaceLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <h2 className="font-serif italic text-2xl animate-pulse">Initializing Workspace...</h2>
          <p className="text-[10px] font-mono uppercase opacity-50 mt-2 tracking-widest">Intelligent Investors</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen pl-64">
      <NavBar />
      
      <header className="h-20 border-b border-[var(--line)] bg-white flex items-center justify-between px-12 sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Active Lane:</span>
            <ModeSelector />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <LearnToggle />
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Equity</p>
            <p className="font-mono text-sm font-bold">${profile?.equity?.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full border border-[var(--line)] bg-gray-100 flex items-center justify-center overflow-hidden">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="font-serif italic text-lg">{profile?.displayName?.[0] || profile?.email?.[0]}</span>
            )}
          </div>
        </div>
      </header>

      <main className="p-12">
        <Outlet />
      </main>
    </div>
  );
}
