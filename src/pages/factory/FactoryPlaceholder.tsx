import FactoryPageShell from './FactoryPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Construction, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FactoryPlaceholderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

const FactoryPlaceholder = ({ title, description, icon, features }: FactoryPlaceholderProps) => {
  return (
    <FactoryPageShell title={title} description={description}>
      <Card className="border-dashed border-2 border-border bg-gradient-factory-soft">
        <CardContent className="p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-factory flex items-center justify-center shadow-glow mb-5 text-factory-foreground">
            {icon}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-factory mb-3">
            <Sparkles className="h-3 w-3" />
            Próximamente — Fase 2
          </div>
          <h2 className="font-display text-2xl font-semibold mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full mb-6">
            {features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border/60 text-left"
              >
                <Construction className="h-4 w-4 text-factory shrink-0" />
                <span className="text-xs text-foreground">{f}</span>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" disabled>
            Diseño en construcción
          </Button>
        </CardContent>
      </Card>
    </FactoryPageShell>
  );
};

export default FactoryPlaceholder;
