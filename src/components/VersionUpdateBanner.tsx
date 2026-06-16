import { useAppVersion } from '@/hooks/useAppVersion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VersionUpdateBanner = () => {
  const { hasNewVersion, currentVersion, acknowledgeAndReload, dismissUpdate } = useAppVersion();

  if (!hasNewVersion) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground py-2 px-4 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">
        Nueva versión disponible ({currentVersion}). Actualiza para ver los últimos cambios.
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        onClick={acknowledgeAndReload}
      >
        Actualizar ahora
      </Button>
      <button onClick={dismissUpdate} className="ml-2 hover:opacity-70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default VersionUpdateBanner;
