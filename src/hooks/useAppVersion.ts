import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'tremu_acked_version';

export const useAppVersion = () => {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [hasNewVersion, setHasNewVersion] = useState(false);

  const check = (dbVersion: string) => {
    setCurrentVersion(dbVersion);
    const acked = localStorage.getItem(STORAGE_KEY);
    if (!acked) {
      // First ever visit: store version, no banner needed
      localStorage.setItem(STORAGE_KEY, dbVersion);
    } else if (acked !== dbVersion) {
      setHasNewVersion(true);
    }
  };

  useEffect(() => {
    const fetchVersion = async () => {
      const { data } = await supabase
        .from('app_version')
        .select('version')
        .limit(1)
        .single();
      if (data) check(data.version);
    };

    fetchVersion();

    const channel = supabase
      .channel('app-version-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_version' },
        (payload) => check((payload.new as any).version)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const acknowledgeAndReload = () => {
    if (currentVersion) localStorage.setItem(STORAGE_KEY, currentVersion);
    window.location.reload();
  };

  const dismissUpdate = () => {
    if (currentVersion) localStorage.setItem(STORAGE_KEY, currentVersion);
    setHasNewVersion(false);
  };

  return { currentVersion, hasNewVersion, acknowledgeAndReload, dismissUpdate };
};
