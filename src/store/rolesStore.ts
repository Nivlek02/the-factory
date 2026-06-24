import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomRole {
  id: string;
  label: string;
  isDefault: boolean;
}

const DEFAULT_ROLES: CustomRole[] = [
  { id: 'copy',       label: 'Copy',         isDefault: true },
  { id: 'diseno',     label: 'Diseño',        isDefault: true },
  { id: 'social',     label: 'Social Media',  isDefault: true },
  { id: 'seo',        label: 'SEO',           isDefault: true },
  { id: 'produccion', label: 'Producción',    isDefault: true },
  { id: 'estratega',  label: 'Estratega',     isDefault: true },
];

interface RolesStore {
  roles: CustomRole[];
  addRole: (label: string) => void;
  updateRole: (id: string, label: string) => void;
  removeRole: (id: string) => void;
}

export const useRolesStore = create<RolesStore>()(
  persist(
    (set) => ({
      roles: DEFAULT_ROLES,

      addRole: (label) =>
        set((s) => ({
          roles: [
            ...s.roles,
            { id: `role-${Date.now()}`, label: label.trim(), isDefault: false },
          ],
        })),

      updateRole: (id, label) =>
        set((s) => ({
          roles: s.roles.map((r) => (r.id === id ? { ...r, label: label.trim() } : r)),
        })),

      removeRole: (id) =>
        set((s) => ({
          roles: s.roles.filter((r) => r.id !== id || r.isDefault),
        })),
    }),
    { name: 'factory-roles-store' }
  )
);
