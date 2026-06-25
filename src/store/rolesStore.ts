import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomRole {
  id: string;
  label: string;
  isDefault: boolean;
  tareas: string[];
}

const DEFAULT_TAREAS: Record<string, string[]> = {
  copy:        [],
  diseno:      ['Diseño de piezas gráficas'],
  social:      [],
  seo:         [],
  produccion:  ['Landing page'],
  estratega:   [],
  gestor_canales: ['Formulario de inscripción', 'Landing'],
};

const DEFAULT_ROLES: CustomRole[] = [
  { id: 'copy',           label: 'Copy',              isDefault: true, tareas: DEFAULT_TAREAS.copy },
  { id: 'diseno',         label: 'Diseño',             isDefault: true, tareas: DEFAULT_TAREAS.diseno },
  { id: 'social',         label: 'Social Media',       isDefault: true, tareas: DEFAULT_TAREAS.social },
  { id: 'seo',            label: 'SEO',                isDefault: true, tareas: DEFAULT_TAREAS.seo },
  { id: 'produccion',     label: 'Producción',         isDefault: true, tareas: DEFAULT_TAREAS.produccion },
  { id: 'estratega',      label: 'Estratega',          isDefault: true, tareas: DEFAULT_TAREAS.estratega },
  { id: 'gestor_canales', label: 'Gestor de canales',  isDefault: true, tareas: DEFAULT_TAREAS.gestor_canales },
];

interface RolesStore {
  roles: CustomRole[];
  addRole: (label: string) => void;
  updateRole: (id: string, label: string) => void;
  removeRole: (id: string) => void;
  addTarea: (roleId: string, tarea: string) => void;
  removeTarea: (roleId: string, index: number) => void;
}

export const useRolesStore = create<RolesStore>()(
  persist(
    (set) => ({
      roles: DEFAULT_ROLES,

      addRole: (label) =>
        set((s) => ({
          roles: [
            ...s.roles,
            { id: `role-${Date.now()}`, label: label.trim(), isDefault: false, tareas: [] },
          ],
        })),

      updateRole: (id, label) =>
        set((s) => ({
          roles: s.roles.map((r) => (r.id === id ? { ...r, label: label.trim() } : r)),
        })),

      removeRole: (id) =>
        set((s) => ({
          roles: s.roles.filter((r) => r.id !== id),
        })),

      addTarea: (roleId, tarea) =>
        set((s) => ({
          roles: s.roles.map((r) =>
            r.id === roleId ? { ...r, tareas: [...r.tareas, tarea.trim()] } : r
          ),
        })),

      removeTarea: (roleId, index) =>
        set((s) => ({
          roles: s.roles.map((r) =>
            r.id === roleId
              ? { ...r, tareas: r.tareas.filter((_, i) => i !== index) }
              : r
          ),
        })),
    }),
    { name: 'factory-roles-store' }
  )
);
