import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Menu,
  Video,
  Wrench,
  Factory,
  Sparkles,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuthStore, ROLE_LABELS } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const AppSidebar = ({ collapsed = false, onToggle }: AppSidebarProps) => {
  const { currentUser } = useAuthStore();

  const NavItem = ({
    to,
    icon,
    label,
    end,
  }: {
    to: string;
    icon: React.ReactNode;
    label: string;
    end?: boolean;
  }) => {
    const content = (
      <NavLink
        to={to}
        end={end}
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all ${
          collapsed ? 'justify-center px-0' : ''
        }`}
        activeClassName="bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-white/5"
      >
        <span className={`${collapsed ? '[&>svg]:h-5 [&>svg]:w-5' : '[&>svg]:h-[18px] [&>svg]:w-[18px]'} shrink-0`}>
          {icon}
        </span>
        {!collapsed && <span className="text-sm font-medium tracking-tight">{label}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  const SectionLabel = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => {
    if (collapsed) return <div className="h-px bg-sidebar-border/60 my-3 mx-3" />;
    return (
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] mb-2 px-3 flex items-center gap-2 ${
          accent ? 'text-primary-glow' : 'text-sidebar-foreground/45'
        }`}
      >
        {children}
      </p>
    );
  };

  const isMercadeo = currentUser?.role === 'mercadeo';

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-sidebar text-sidebar-foreground h-screen flex flex-col flex-shrink-0 transition-all duration-300 border-r border-sidebar-border`}
    >
      {/* Header */}
      <div className={`${collapsed ? 'p-3' : 'p-5'} border-b border-sidebar-border`}>
        <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/fabrica-logo.svg"
                alt="La Fábrica"
                className="w-9 h-9 rounded-xl shadow-glow shrink-0"
              />
              <div className="min-w-0">
                <h1 className="font-logo text-lg leading-none text-sidebar-foreground">Tremu</h1>
                <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50 mt-1">
                  La fabrica
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4">
        {/* THE FACTORY */}
        <div className="px-2 mb-5">
          <SectionLabel accent>
            <Sparkles className="h-3 w-3" />
            Principal
          </SectionLabel>
          <div className="space-y-0.5">
            <NavItem to="/" end icon={<Factory />} label="La Fabrica" />
          </div>
        </div>

        {/* GENERAL */}
        <div className="px-2 mb-5">
          <SectionLabel>General</SectionLabel>
          <div className="space-y-0.5">
            <NavItem to="/reports" icon={<BarChart3 />} label="Reportes" />
            <NavItem to="/webinars" icon={<Video />} label="Seguimiento de eventos" />
            <NavItem to="/herramientas" icon={<Wrench />} label="Herramientas" />
            <NavItem to="/settings" icon={<Settings />} label="Ajustes" />
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className={`p-3 border-t border-sidebar-border ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-factory flex items-center justify-center text-[11px] font-semibold text-factory-foreground shadow-sm">
            {currentUser?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">
              {currentUser?.fullName || 'Usuario'}
            </p>
            <p className="text-[11px] text-sidebar-foreground/55 truncate">
              Demo · {currentUser ? ROLE_LABELS[currentUser.role] : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
