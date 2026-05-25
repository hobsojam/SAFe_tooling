import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDemoMode } from '../hooks/useDemoMode';
import { api } from '../api';
import type { PICreate } from '../types';
import { Modal } from './Modal';
import { PIStatusBadge } from './Badge';
import { useToast } from './Toaster';

type NavItem = { to: string; label: string; primary?: boolean };
type NavGroup = { heading: string; items: NavItem[] };

const navItem = (to: string, label: string, primary = false): NavItem => ({
  to,
  label,
  primary,
});

const NAV_LINK_BASE = 'block rounded px-3 py-2 text-sm font-medium transition-colors';
const NAV_LINK_ACTIVE = 'bg-slate-700 text-white';
const NAV_LINK_PRIMARY = 'text-slate-200 hover:bg-slate-800 hover:text-white';
const NAV_LINK_DEFAULT = 'text-slate-400 hover:bg-slate-800 hover:text-slate-100';

function navLinkClass({ isActive, primary }: { isActive: boolean; primary?: boolean }) {
  const inactive = primary ? NAV_LINK_PRIMARY : NAV_LINK_DEFAULT;
  return `${NAV_LINK_BASE} ${isActive ? NAV_LINK_ACTIVE : inactive}`;
}

function navSectionClass(isActive: boolean) {
  return `cursor-pointer rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors marker:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
    isActive ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
  }`;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  navItem('health', 'PI Health', true),
  navItem('board', 'Board', true),
  navItem('backlog', 'Backlog', true),
  navItem('risks', 'Risks', true),
  navItem('dependencies', 'Dependencies', true),
];

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Planning',
    items: [
      navItem('stories', 'Stories'),
      navItem('objectives', 'Objectives'),
      navItem('capacity', 'Capacity'),
    ],
  },
  {
    heading: 'Ceremonies',
    items: [
      navItem('art-sync', 'ART Sync'),
      navItem('predictability', 'Predictability'),
      navItem('inspect-adapt', 'Inspect & Adapt'),
    ],
  },
];

const PI_SETUP_ITEMS: NavItem[] = [
  navItem('setup', 'PI Setup'),
  navItem('team-setup', 'Team Setup'),
];

const EMPTY_PI_FORM: PICreate = {
  name: '',
  art_id: '',
  start_date: '',
  end_date: '',
};

export function Layout() {
  const { piId } = useParams<{ piId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const isDemo = useDemoMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [piModalOpen, setPiModalOpen] = useState(false);
  const [piForm, setPiForm] = useState<PICreate>(EMPTY_PI_FORM);
  const [piError, setPiError] = useState('');

  const { data: pis = [] } = useQuery({
    queryKey: ['pis'],
    queryFn: api.listPIs,
  });

  const { data: arts = [] } = useQuery({
    queryKey: ['arts'],
    queryFn: api.listARTs,
  });

  const activePi = pis.find((p) => p.id === piId);

  const createPIMut = useMutation({
    mutationFn: (body: PICreate) => api.createPI(body),
    onSuccess: (pi) => {
      qc.invalidateQueries({ queryKey: ['pis'] });
      setPiModalOpen(false);
      navigate(`/pi/${pi.id}/board`);
      toast('PI created');
    },
    onError: (e: Error) => setPiError(e.message),
  });

  function openNewPI() {
    setPiForm({ name: '', art_id: arts[0]?.id ?? '', start_date: '', end_date: '' });
    setPiError('');
    setPiModalOpen(true);
  }

  function handlePISubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!piForm.name.trim()) { setPiError('Name is required.'); return; }
    if (!piForm.art_id) { setPiError('ART is required.'); return; }
    if (!piForm.start_date || !piForm.end_date) { setPiError('Start and end dates are required.'); return; }
    createPIMut.mutate(piForm);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const setupIsActive = location.pathname === '/art-setup'
    || PI_SETUP_ITEMS.some(({ to }) => location.pathname === `/pi/${piId}/${to}`);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {isDemo && (
        <div
          role="banner"
          className="shrink-0 w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-800"
        >
          Demo mode — data resets on each server restart. Do not enter real or sensitive information.
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 w-full cursor-default bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on md+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-5">
          <span className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            SAFe Tools
          </span>
          <p className="mt-0.5 text-xs text-slate-500">v{__APP_VERSION__}</p>
        </div>

        {/* PI selector */}
        <div className="px-3 pb-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label
              htmlFor="pi-select"
              className="block text-xs text-slate-400"
            >
              Program Increment
            </label>
            <button
              type="button"
              onClick={() => { openNewPI(); closeSidebar(); }}
              className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="+ New PI"
              title="New PI"
            >
              +
            </button>
          </div>
          <select
            id="pi-select"
            value={piId ?? ''}
            onChange={(e) => {
              if (e.target.value) {
                navigate(`/pi/${e.target.value}/board`);
                closeSidebar();
              }
            }}
            className="w-full rounded bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="" disabled>
              Select PI…
            </option>
            {pis.map((pi) => (
              <option key={pi.id} value={pi.id}>
                {pi.name}
              </option>
            ))}
          </select>
          {activePi && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
              <PIStatusBadge status={activePi.status} />
              <span>
                {activePi.start_date} – {activePi.end_date}
              </span>
            </div>
          )}
        </div>

        {/* Nav links */}
        {piId && (
          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="space-y-0.5">
              {PRIMARY_NAV_ITEMS.map(({ to, label, primary }) => (
                <NavLink
                  key={to}
                  to={`/pi/${piId}/${to}`}
                  onClick={closeSidebar}
                  className={({ isActive }) => navLinkClass({ isActive, primary })}
                >
                  {label}
                </NavLink>
              ))}
            </div>

            <div className="mt-3 space-y-1">
              {NAV_GROUPS.map((group) => {
                const groupIsActive = group.items.some(({ to }) => location.pathname === `/pi/${piId}/${to}`);
                return (
                  <details key={group.heading} open={groupIsActive}>
                    <summary className={navSectionClass(groupIsActive)}>
                      {group.heading}
                    </summary>
                    <div className="mt-1 space-y-0.5">
                      {group.items.map(({ to, label, primary }) => (
                        <NavLink
                          key={to}
                          to={`/pi/${piId}/${to}`}
                          onClick={closeSidebar}
                          className={({ isActive }) => navLinkClass({ isActive, primary })}
                        >
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </nav>
        )}

        {/* Global views */}
        <div className="border-t border-slate-700 px-2 pt-2 pb-1">
          <NavLink
            to="/roadmap"
            onClick={closeSidebar}
            className={({ isActive }) => navLinkClass({ isActive })}
          >
            Roadmap
          </NavLink>
        </div>

        {/* Global setup */}
        <div className="mt-auto border-t border-slate-700 px-2 pt-2">
          <details open={setupIsActive}>
            <summary className={navSectionClass(setupIsActive)}>
              Setup
            </summary>
            <div className="mt-1 space-y-0.5">
              {piId && PI_SETUP_ITEMS.map(({ to, label, primary }) => (
                <NavLink
                  key={to}
                  to={`/pi/${piId}/${to}`}
                  onClick={closeSidebar}
                  className={({ isActive }) => navLinkClass({ isActive, primary })}
                >
                  {label}
                </NavLink>
              ))}
              <NavLink
                to="/art-setup"
                onClick={closeSidebar}
                className={({ isActive }) => navLinkClass({ isActive })}
              >
                ART Setup
              </NavLink>
            </div>
          </details>
        </div>

        {/* Disclaimer */}
        <p className="px-3 py-3 text-xs leading-tight text-slate-500">
          Unofficial SAFe® tooling.
        </p>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex shrink-0 items-center gap-3 bg-slate-900 px-3 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-300 hover:text-white"
            aria-label="Open navigation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            SAFe Tools
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {piId || !location.pathname.startsWith('/pi') ? (
            <Outlet />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <p className="text-sm">Select a Program Increment to get started.</p>
            </div>
          )}
        </main>
      </div>

      <Modal
        open={piModalOpen}
        title="New Program Increment"
        onClose={() => setPiModalOpen(false)}
      >
        <form onSubmit={handlePISubmit} className="space-y-4">
          {piError && <p className="text-sm text-red-600">{piError}</p>}

          <div>
            <label htmlFor="pi-name" className="mb-1 block text-sm font-medium text-slate-700">
              Name<span aria-hidden="true"> *</span>
            </label>
            <input
              id="pi-name"
              type="text"
              value={piForm.name}
              onChange={(e) => setPiForm({ ...piForm, name: e.target.value })}
              placeholder="e.g. PI 2026.2"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label htmlFor="pi-art" className="mb-1 block text-sm font-medium text-slate-700">
              ART<span aria-hidden="true"> *</span>
            </label>
            <select
              id="pi-art"
              value={piForm.art_id}
              onChange={(e) => setPiForm({ ...piForm, art_id: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Select ART…</option>
              {arts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {arts.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                No ARTs found.{' '}
                <a href="/art-setup" className="underline hover:text-slate-300">
                  Create one in ART Setup.
                </a>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pi-start" className="mb-1 block text-sm font-medium text-slate-700">
                Start Date<span aria-hidden="true"> *</span>
              </label>
              <input
                id="pi-start"
                type="date"
                value={piForm.start_date}
                onChange={(e) => setPiForm({ ...piForm, start_date: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label htmlFor="pi-end" className="mb-1 block text-sm font-medium text-slate-700">
                End Date<span aria-hidden="true"> *</span>
              </label>
              <input
                id="pi-end"
                type="date"
                value={piForm.end_date}
                onChange={(e) => setPiForm({ ...piForm, end_date: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPiModalOpen(false)}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPIMut.isPending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {createPIMut.isPending ? 'Creating…' : 'Create PI'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
    </div>
  );
}
