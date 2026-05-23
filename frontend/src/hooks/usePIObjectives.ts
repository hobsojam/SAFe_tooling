import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { PI, PIObjective } from '../types';

interface UsePIObjectivesResult {
  piId: string | undefined;
  pi: PI | undefined;
  objectives: PIObjective[];
  isLoading: boolean;
}

export function usePIObjectives(): UsePIObjectivesResult {
  const { piId } = useParams<{ piId: string }>();

  const { data: pi } = useQuery({
    queryKey: ['pi', piId],
    queryFn: () => api.getPI(piId!),
    enabled: !!piId,
  });

  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ['objectives', piId],
    queryFn: () => api.listObjectives(piId!),
    enabled: !!piId,
  });

  return { piId, pi, objectives, isLoading };
}
