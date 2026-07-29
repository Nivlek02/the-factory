import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { ClipboardList } from 'lucide-react';
import { useFactoryStore } from '@/store/factoryStore';
import { useCampanasFrescas } from '@/hooks/useCampanasFrescas';
import { MyTasks } from '@/components/factory/MyTasks';

const MisTareasPage = () => {
  const navigate = useNavigate();
  const { setActiveProject } = useFactoryStore();

  // Sin esto, la lista mostraba el estado de cuando se abrió la pestaña: una tarea ya aprobada por
  // otra persona seguía apareciendo pendiente.
  useCampanasFrescas();

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
