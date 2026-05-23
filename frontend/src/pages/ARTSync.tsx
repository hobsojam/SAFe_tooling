import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';

type CellVariant = 'empty' | 'not_started' | 'in_progress' | 'all_done';

function getCellVariant(committed: number, done: number): CellVariant {
  if (committed === 0) return 'empty';
  if (done === committed) return 'all_done';
  if (done > 0) return 'in_progress';
  return 'not_started';
}

const CELL_BG: Record<CellVariant, string> = {
  empty: '',
  not_started: 'bg-amber-50',
  in_progress: 'bg-blue-50',
  all_done: 'bg-teal-50',
};

const CELL_TEXT: Record<CellVariant, string> = {
  empty: 'text-slate-300',
  not_started: 'font-semibold text-amber-900',
  in_progress: 'font-semibold text-blue-900',
  all_done: 'font-semibold text-teal-900',
};

const TH = 'px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide';

export function ARTSync() {
  const { piId } = useParams<{ piId: string }>();

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId!),
    enabled: !!piId,
  });

  const { data: iterations = [], isLoading: loadingIter } = useQuery({
    queryKey: ['iterations', piId],
    queryFn: () => api.listIterations(piId!),
    enabled: !!piId,
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', pi?.art_id],
    queryFn: () => api.listTeamsByArt(pi!.art_id),
    enabled: !!pi?.art_id,
  });

  const { data: stories = [], isLoading: loadingStories } = useQuery({
    queryKey: ['stories'],
    queryFn: api.listStories,
  });

  if (loadingIter || loadingTeams || loadingStories) return <Spinner />;

  const nonIpIterations = [...iterations]
    .filter((it) => !it.is_ip)
    .sort((a, b) => a.number - b.number);

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  const iterIds = new Set(nonIpIterations.map((it) => it.id));

  const committedMap: Record<string, number> = {};
  const doneMap: Record<string, number> = {};
  for (const story of stories) {
    if (story.iteration_id && iterIds.has(story.iteration_id)) {
      const key = `${story.team_id}:${story.iteration_id}`;
      committedMap[key] = (committedMap[key] ?? 0) + 1;
      if (story.status === 'done' || story.status === 'accepted') {
        doneMap[key] = (doneMap[key] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">ART Sync — {pi?.name}</h1>
        <p className="text-sm text-slate-500">
          Story progress per team per iteration. Done / committed story counts.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-teal-100 border border-teal-200" aria-hidden="true" />
          <span>All done</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-100 border border-blue-200" aria-hidden="true" />
          <span>In progress</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-100 border border-amber-200" aria-hidden="true" />
          <span>Not started</span>
        </span>
      </div>

      {nonIpIterations.length === 0 || sortedTeams.length === 0 ? (
        <EmptyState
          message={
            nonIpIterations.length === 0
              ? 'No iterations defined for this PI.'
              : 'No teams found. Add teams via Team Setup first.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={TH}>Team</th>
                {nonIpIterations.map((iter) => (
                  <th key={iter.id} className={TH}>
                    Iteration {iter.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTeams.map((team) => (
                <tr key={team.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">{team.name}</td>
                  {nonIpIterations.map((iter) => {
                    const key = `${team.id}:${iter.id}`;
                    const committed = committedMap[key] ?? 0;
                    const done = doneMap[key] ?? 0;
                    const variant = getCellVariant(committed, done);
                    return (
                      <td
                        key={iter.id}
                        className={`px-4 py-3 tabular-nums ${CELL_BG[variant]}`}
                      >
                        <span className={`text-sm ${CELL_TEXT[variant]}`}>
                          {committed === 0 ? '—' : `${done} / ${committed}`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
