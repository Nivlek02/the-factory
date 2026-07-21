import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { ClipboardList } from 'lucide-react';
import { useFactoryStore } from '@/store/factoryStore';
import { MyTasks } from '@/components/factory/MyTasks';

const MisTareasPage = () => {
  const navigate = useNavigate();
  const { hydrate, isLoaded, setActiveProject } = useFactoryStore();

  useEffect(() => {
    if (!isLoaded) hydrate();
  }, [isLoaded, hydrate]);

  // Abrir una tarea = activar su campaña y saltar a La Fábrica, donde vive el flujo de trabajo.
  const openProject = (projectId: string) => {
    setActiveProject(projectId);
    navigate('/');
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mis tareas</h1>
              <p className="text-muted-foreground">Tus tareas asignadas en todas las campañas, por urgencia</p>
            </div>
          </div>
        </div>

        <MyTasks onOpenProject={openProject} />
      </div>
    </Layout>
  );
};

export default MisTareasPage;
