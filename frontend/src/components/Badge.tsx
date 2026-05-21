type Variant = 'red' | 'yellow' | 'amber' | 'cyan' | 'green' | 'blue' | 'gray' | 'purple';

const STYLES: Record<Variant, string> = {
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  amber: 'bg-amber-100 text-amber-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({ label, variant }: Readonly<{ label: string; variant: Variant }>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[variant]}`}
    >
      {label}
    </span>
  );
}

export function ROAMBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, Variant> = {
    unroamed: 'red',
    owned: 'yellow',
    accepted: 'amber',
    mitigated: 'cyan',
    resolved: 'green',
  };
  return <Badge label={status} variant={map[status] ?? 'gray'} />;
}

export function DepBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, Variant> = {
    identified: 'red',
    acknowledged: 'yellow',
    in_progress: 'cyan',
    resolved: 'green',
  };
  return <Badge label={status.replace(/_/g, ' ')} variant={map[status] ?? 'gray'} />;
}

export function PIStatusBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, Variant> = {
    planning: 'blue',
    active: 'green',
    closed: 'gray',
  };
  return <Badge label={status} variant={map[status] ?? 'gray'} />;
}

export function FeatureStatusBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, Variant> = {
    funnel: 'purple',
    analyzing: 'blue',
    backlog: 'gray',
    implementing: 'amber',
    done: 'green',
  };
  return <Badge label={status} variant={map[status] ?? 'gray'} />;
}

export function StoryStatusBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, Variant> = {
    not_started: 'gray',
    in_progress: 'blue',
    done: 'cyan',
    accepted: 'green',
  };
  return <Badge label={status.replace(/_/g, ' ')} variant={map[status] ?? 'gray'} />;
}

export const TOPOLOGY_LABELS: Record<string, string> = {
  stream_aligned: 'Stream-aligned',
  enabling: 'Enabling',
  complicated_subsystem: 'Complicated-subsystem',
  platform: 'Platform',
};

export function TopologyBadge({ type }: Readonly<{ type: string | null }>) {
  if (!type) return null;
  const map: Record<string, Variant> = {
    stream_aligned: 'blue',
    enabling: 'green',
    complicated_subsystem: 'purple',
    platform: 'amber',
  };
  return <Badge label={TOPOLOGY_LABELS[type] ?? type} variant={map[type] ?? 'gray'} />;
}
