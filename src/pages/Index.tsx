import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { useAuthStore } from '@/store/authStore';
import { BOARDS, STATUSES } from '@/types';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  ArrowRight, 
  ListTodo, 
  Clock, 
  CheckCircle2, 
  
  Palette,
    PenTool,
    Share2,
    Search,
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TASKS_PER_PAGE = 5;

const Index = () => {
  const { tasks, loading } = useSupabaseTasks();
  const [recentPage, setRecentPage] = useState(1);
  const { currentUser } = useAuthStore();

  // El acceso a tableros ya no se restringe por rol — el rol es solo informativo.
  const filteredTasks = tasks;

  // Stats
  const pendingCount = filteredTasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = filteredTasks.filter((t) => t.status === 'completed').length;
  const reopenedCount = filteredTasks.filter((t) => t.reopenedCount > 0).length;

  // Recent tasks (all sorted, then paginated)
  const allRecentTasks = [...filteredTasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalRecentPages = Math.ceil(allRecentTasks.length / TASKS_PER_PAGE);
  const recentTasks = allRecentTasks.slice((recentPage - 1) * TASKS_PER_PAGE, recentPage * TASKS_PER_PAGE);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-status-pending-bg text-status-pending';
      case 'in_progress':
        return 'bg-status-progress-bg text-status-progress';
      case 'completed':
        return 'bg-status-completed-bg text-status-completed';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getBoardIcon = (boardId: string) => {
    switch (boardId) {
      case 'design':
        return <Palette className="h-5 w-5 text-board-design" />;
      case 'copys':
        return <PenTool className="h-5 w-5 text-board-copys" />;
      case 'social_media':
        return <Share2 className="h-5 w-5 text-board-social" />;
      case 'seo':
        return <Search className="h-5 w-5 text-board-seo" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 lg:p-5 animate-fade-in">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                ¡Hola, {currentUser?.fullName.split(' ')[0] || 'Usuario'}!
              </h1>
              <p className="text-sm text-muted-foreground">Aquí tienes un resumen de tus tareas</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="border-l-4 border-l-status-pending">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-status-pending-bg flex items-center justify-center">
                  <ListTodo className="h-5 w-5 text-status-pending" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-status-progress">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">En proceso</p>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-status-progress-bg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-status-progress" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-status-completed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-status-completed-bg flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-status-completed" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Con ajustes</p>
                  <p className="text-2xl font-bold">{reopenedCount}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Boards */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-base font-semibold text-foreground">Tableros</h2>
            {BOARDS.map((board) => {
              const boardTasks = filteredTasks.filter((t) => t.board === board.id);
              const boardPending = boardTasks.filter((t) => t.status === 'pending').length;
              const boardProgress = boardTasks.filter((t) => t.status === 'in_progress').length;

              return (
                <Link key={board.id} to={`/board/${board.id}`}>
                  <Card className="hover:shadow-card-hover transition-shadow cursor-pointer group">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getBoardIcon(board.id)}
                          <div>
                            <h3 className="font-semibold text-sm text-foreground">{board.name}</h3>
                            <p className="text-xs text-muted-foreground">{boardTasks.length} tareas</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-status-pending-bg text-status-pending text-xs">
                          {boardPending} pendientes
                        </Badge>
                        <Badge className="bg-status-progress-bg text-status-progress text-xs">
                          {boardProgress} en proceso
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Recent Tasks */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Tareas recientes</h2>
              <Link to="/reports">
                <Button variant="ghost" size="sm">
                  Ver todas
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            <Card>
              <CardContent className="pt-3 pb-3">
                {recentTasks.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No hay tareas aún</p>
                ) : (
                  <div className="space-y-2">
                    {recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getBoardIcon(task.board)}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.creatorName} • {format(new Date(task.createdAt), "d MMM", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.reopenedCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {task.reopenedCount}
                            </Badge>
                          )}
                          <Badge className={cn("text-xs", getStatusColor(task.status))}>
                            {STATUSES[task.status]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {totalRecentPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <span className="text-sm text-muted-foreground">
                      Página {recentPage} de {totalRecentPages}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={recentPage <= 1} onClick={() => setRecentPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={recentPage >= totalRecentPages} onClick={() => setRecentPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
