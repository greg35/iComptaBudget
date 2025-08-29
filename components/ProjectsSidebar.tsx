import { Project, ViewType } from "../types/budget";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "./ui/sidebar";
import { CreateProjectForm } from "./CreateProjectForm";
import { Folder, Plus, Home, Settings, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { useState } from "react";

interface ProjectsSidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  currentView: ViewType;
  showActiveOnly: boolean;
  onProjectSelect: (projectId: string) => void;
  onViewChange: (view: ViewType) => void;
  onCreateProject: (project: Omit<Project, 'id' | 'currentSavings' | 'currentSpent'>) => void;
  onShowActiveOnlyChange: (showActiveOnly: boolean) => void;
}

export function ProjectsSidebar({ projects, selectedProjectId, currentView, showActiveOnly, onProjectSelect, onViewChange, onCreateProject, onShowActiveOnlyChange }: ProjectsSidebarProps) {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const fmt = (v?: number | null) => new Intl.NumberFormat('fr-FR').format(Number(v ?? 0));
  // sort projects by name descending (Z -> A), handle missing names
  const sorted = [...(projects || [])].sort((a, b) => {
    const na = (a && a.name) ? String(a.name) : '';
    const nb = (b && b.name) ? String(b.name) : '';
    return nb.localeCompare(na, 'fr', { sensitivity: 'base' });
  });

  // filter by active only if requested: not archived
  const visible = sorted.filter(p => {
    if (!showActiveOnly) return true;
    return !p.archived;
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">iCompta Budget</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Actifs seulement</span>
            <Switch checked={showActiveOnly} onCheckedChange={(v) => onShowActiveOnlyChange(Boolean(v))} />
          </div>
        </div>
        <Button size="sm" className="w-full mt-2" onClick={() => setIsCreateFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {/* Navigation principale */}
        <SidebarMenu className="mb-4">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onViewChange('home')}
              isActive={currentView === 'home'}
              className="w-full"
            >
              <Home className="h-4 w-4" />
              <span>Accueil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onViewChange('monthly-savings')}
              isActive={currentView === 'monthly-savings'}
              className="w-full"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Épargne Mensuelle</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="mb-4" />
        <SidebarMenu>
          {visible.map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                onClick={() => onProjectSelect(project.id)}
                isActive={selectedProjectId === project.id}
                className="w-full"
              >
                <Folder className="h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span>{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(project.currentSavings)}€ / {fmt(project.plannedBudget)}€
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

            
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onViewChange('settings')}
              isActive={currentView === 'settings'}
              className="w-full"
            >
              <Settings className="h-4 w-4" />
              <span>Paramètres</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <CreateProjectForm
        isOpen={isCreateFormOpen}
        onClose={() => setIsCreateFormOpen(false)}
        onCreateProject={onCreateProject}
      />
    </Sidebar>
  );
}

function NewProjectDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (name: string) => Promise<void> | void; }) {
  const [name, setName] = useState('');
  return (
    <div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-80">
            <h3 className="font-semibold mb-2">Nouveau projet</h3>
            <input className="w-full border px-2 py-1 mb-3" value={name} onChange={e => setName(e.target.value)} placeholder="Nom du projet" />
            <div className="flex justify-end gap-2">
              <button className="text-muted-foreground" onClick={() => onOpenChange(false)}>Annuler</button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={() => { onCreate(name); }} disabled={!name.trim()}>Créer</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}