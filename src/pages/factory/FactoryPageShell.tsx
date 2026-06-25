import { ReactNode } from 'react';
import Layout from '@/components/layout/Layout';
import { Sparkles } from 'lucide-react';

interface FactoryPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const FactoryPageShell = ({
  eyebrow = 'La Fabrica',
  title,
  description,
  actions,
  children,
}: FactoryPageShellProps) => {
  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Page header */}
        <header className="border-b border-border/60 bg-gradient-surface">
          <div className="px-6 lg:px-8 py-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-factory">
                  <Sparkles className="h-3 w-3" />
                  {eyebrow}
                </span>
              </div>
              <h1 className="font-display text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </header>

        <div className="px-6 lg:px-8 py-6">{children}</div>
      </div>
    </Layout>
  );
};

export default FactoryPageShell;
