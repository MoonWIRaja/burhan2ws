import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import * as api from '../services/api';

/**
 * Hook untuk mendapatkan session automatik berdasarkan user yang login
 * User tidak perlu pilih session - sistem automatik guna session mereka
 */
export function useSession() {
  const { user } = useAuth();

  // Fetch semua sessions
  const { data: sessionsData, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.sessionsApi.getAll().then((res) => res.data),
    refetchInterval: 5000,
    enabled: !!user, // Hanya fetch jika user ada
  });

  const sessions = sessionsData?.data?.sessions || [];

  // Dapatkan session user (session yang aktif dan connected)
  // Untuk sekarang, kita ambil session pertama yang connected
  // Kalau user ada multiple sessions, boleh modify sini
  const userSession = sessions.find((s) => s.status === 'connected');

  return {
    session: userSession,
    sessionId: userSession?.sessionId || userSession?.id || '',
    sessions,
    isLoading,
    error,
    isConnected: !!userSession,
  };
}
