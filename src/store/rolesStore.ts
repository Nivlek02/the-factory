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
  soporte:     [],
};

/** Roles visibles para asignar equipo a un proyecto (pestaña Equipo). 'social', 'seo' y
 *  'produccion' se mantienen abajo porque la generación automática de tareas por canal
 *  (CreateProjectWizard) todavía depende de esos ids, pero ya no se ofrecen para asignación
 *  manual — las responsabilidades por rol se gestionan desde el backend. */
const DEFAULT_ROLES: CustomRole[] = [
  { id: 'copy',           label: 'Copywriter',        isDefault: true, tareas: DEFAULT_TAREAS.copy },
  { id: 'diseno',         label: 'Diseñador',          isDefault: true, tareas: DEFAULT_TAREAS.diseno },
  { id: 'gestor_canales', label: 'Gestor de canales',  isDefault: true, tareas: DEFAULT_TAREAS.gestor_canales },
  { id: 'estratega',      label: 'Estratega',          isDefault: true, tareas: DEFAULT_TAREAS.estratega },
  { id: 'soporte',        label: 'Soporte',            isDefault: true, tareas: DEFAULT_TAREAS.soporte },
  { id: 'social',         label: 'Social Media',       isDefault: true, tareas: DEFAULT_TAREAS.social },
  { id: 'seo',            label: 'SEO',                isDefault: true, tareas: DEFAULT_TAREAS.seo },
  { id: 'produccion',     label: 'Producción',         isDefault: true, tareas: DEFAULT_TAREAS.produccion },
];

/** Los 5 roles asignables desde la pestaña Equipo de un proyecto. */
export const ASSIGNABLE_ROLE_IDS = ['copy', 'diseno', 'gestor_canales', 'estratega', 'soporte'];

interface RolesStore {
  roles: CustomRole[];
  addRole: (label: string, tareas?: string[]) => void;
  updateRole: (id: string, label: string) => void;
  removeRole: (id: string) => void;
  addTarea: (roleId: string, tarea: string) => void;
  removeTarea: (roleId: string, index: number) => void;
}

export const useRolesStore = create<RolesStore>()(
  persist(
    (set) => ({
      roles: DEFAULT_ROLES,

      addRole: (label, tareas) =>
        set((s) => ({
          roles: [
            ...s.roles,
            { id: `role-${Date.now()}`, label: label.trim(), isDefault: false, tareas: tareas ?? [] },
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
    {
      name: 'factory-roles-store',
      version: 2,
      migrate: (persisted: any) => {
        const oldRoles: { id: string; label: string; isDefault?: boolean }[] = persisted?.roles ?? [];
        const roles = oldRoles.map((r) => {
          const def = DEFAULT_ROLES.find((d) => d.id === r.id);
          return {
            id: r.id,
            // Los roles por defecto siempre toman la etiqueta canónica actual (ej: "Copy" →
            // "Copywriter"); los roles personalizados conservan el nombre que les dio el usuario.
            label: def ? def.label : r.label,
            isDefault: r.isDefault ?? def?.isDefault ?? false,
            tareas: (r as any).tareas ?? def?.tareas ?? [],
          };
        });
        // Ensure all default roles exist
        for (const def of DEFAULT_ROLES) {
          if (!roles.find((r) => r.id === def.id)) {
            roles.push({ ...def });
          }
        }
        return { ...persisted, roles };
      },
    }
  )
);
