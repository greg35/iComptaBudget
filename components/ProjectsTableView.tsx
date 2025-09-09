import { useState, useRef, useEffect } from "react";
import { Project, ViewType } from "../types/budget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TableProperties, Check, X, Archive, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from '../utils/apiClient';

interface ProjectAllocation {
  projectId: string;
  allocatedAmount: number;
}

interface ProjectsTableViewProps {
  projects: Project[];
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onProjectSelect: (projectId: string) => void;
  onViewChange: (view: ViewType) => void;
}

export function ProjectsTableView({ projects, onUpdateProject, onProjectSelect, onViewChange }: ProjectsTableViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [currentAllocations, setCurrentAllocations] = useState<ProjectAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Récupérer les allocations du mois actuel
  useEffect(() => {
    const fetchCurrentAllocations = async () => {
      try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const response = await apiFetch(`/api/project-allocations/${currentMonth}`);
        
        if (response.ok) {
          const allocations = await response.json();
          setCurrentAllocations(allocations);
        } else {
          setCurrentAllocations([]);
        }
      } catch (error) {
        console.error('Error fetching current allocations:', error);
        setCurrentAllocations([]);
      } finally {
        setLoadingAllocations(false);
      }
    };

    fetchCurrentAllocations();
  }, []);

  // Fonction pour obtenir l'allocation actuelle d'un projet
  const getCurrentAllocation = (projectId: string): number => {
    const allocation = currentAllocations.find(a => a.projectId === projectId);
    console.log(`Allocation for project ${projectId}:`, allocation?.allocatedAmount);
    return allocation?.allocatedAmount || 0;
  };

  const handleStartEdit = (projectId: string, currentValue: number | undefined, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Ne pas entrer en mode édition si on est déjà en train d'éditer ce projet
    if (editingId === projectId) {
      return;
    }
    
    setEditingId(projectId);
    setEditValue(currentValue?.toString() || "");
  };

  // Auto-focus et sélection du texte quand on passe en mode édition
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleSaveEdit = (projectId: string, fromBlur = false) => {
    // Si on n'est pas en mode édition pour ce projet, on ignore
    if (editingId !== projectId) {
      return;
    }

    // Si la valeur n'a pas changé, on annule simplement l'édition
    const currentProject = projects.find(p => p.id === projectId);
    const currentValue = currentProject?.monthlySavingsTarget?.toString() || "";
    
    if (editValue === currentValue) {
      setEditingId(null);
      return;
    }

    // Validation de la valeur
    const value = parseFloat(editValue);
    if (editValue !== "" && (isNaN(value) || value < 0)) {
      toast.error("Veuillez entrer un montant valide");
      // On garde le focus sur l'input en cas d'erreur, sauf si ça vient du blur
      if (!fromBlur) {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 100);
      }
      return;
    }
    
    // Sauvegarder la valeur (undefined si vide)
    const finalValue = editValue === "" ? undefined : value;
    onUpdateProject(projectId, { monthlySavingsTarget: finalValue });
    setEditingId(null);
    toast.success("Montant épargné mensuel mis à jour");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleViewProject = (projectId: string) => {
    onProjectSelect(projectId);
    onViewChange("project");
  };

  const calculateProgress = (project: Project) => {
    return project.plannedBudget > 0 ? (project.currentSavings / project.plannedBudget) * 100 : 0;
  };

  const calculateMonthsRemaining = (project: Project) => {
    const endDate = new Date(project.endDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0, diffMonths);
  };

  const getStatusBadge = (project: Project) => {
    const progress = calculateProgress(project);
    const monthsRemaining = calculateMonthsRemaining(project);
    
    if (project.archived) {
      return <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" />Archivé</Badge>;
    }
    
    if (progress >= 100) {
      return (
        <Badge 
          style={{ backgroundColor: '#16a34a', color: 'white', borderColor: '#16a34a' }}
          className="hover:brightness-110"
        >
          <Check className="h-3 w-3 mr-1" />
          Objectif atteint
        </Badge>
      );
    }
    
    if (monthsRemaining <= 0) {
      return <Badge variant="destructive">Échéance dépassée</Badge>;
    }
    
    if (monthsRemaining <= 1) {
      return (
        <Badge 
          style={{ backgroundColor: '#ea580c', color: 'white', borderColor: '#ea580c' }}
          className="hover:brightness-110"
        >
          Urgent
        </Badge>
      );
    }
    
    return <Badge variant="outline">En cours</Badge>;
  };

  // Séparer les projets actifs et archivés
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const ProjectTable = ({ projects: tableProjects, title, showArchived = false }: { projects: Project[], title: string, showArchived?: boolean }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="outline">{tableProjects.length}</Badge>
        </CardTitle>
        <CardDescription>
          {showArchived ? "Projets archivés et terminés" : "Vue d'ensemble de tous vos projets actifs avec montants épargnés mensuels"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du projet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Budget prévu</TableHead>
                <TableHead>Total Épargné</TableHead>
                <TableHead>Progression</TableHead>
                <TableHead><div className="text-center">Alloué ce mois</div></TableHead>
                <TableHead>Objectif mensuel</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {showArchived ? "Aucun projet archivé" : "Aucun projet actif"}
                  </TableCell>
                </TableRow>
              ) : (
                tableProjects.map((project) => {
                  const progress = calculateProgress(project);
                  const monthsRemaining = calculateMonthsRemaining(project);
                  
                  return (
                    <TableRow key={project.id} className="hover:bg-muted/50">
                      <TableCell>
                          <div className="font-medium">{project.name}</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(project)}
                      </TableCell>
                      <TableCell>
                          <span className="font-medium">
                            {project.plannedBudget.toLocaleString('fr-FR')}€
                          </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {project.currentSavings.toLocaleString('fr-FR')}€
                          </span>
                          <div className="text-sm text-muted-foreground">
                            Dépensé: {project.currentSpent.toLocaleString('fr-FR')}€
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={Math.min(progress, 100)} className="h-2" />
                          <span className="text-sm text-muted-foreground">
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          {loadingAllocations ? (
                            <span className="text-sm text-muted-foreground">...</span>
                          ) : (
                            <span className="font-medium">
                              {getCurrentAllocation(project.id).toLocaleString('fr-FR')}€
                            </span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingId === project.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              ref={inputRef}
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(project.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              onBlur={() => handleSaveEdit(project.id, true)}
                              className="w-20 h-8"
                              min="0"
                              step="0.01"
                            />
                            <span className="text-sm">€</span>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(project.id)}
                              className="h-8 px-2"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="h-8 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="cursor-text hover:bg-accent/50 rounded px-2 py-1 transition-all duration-200 min-w-[80px] inline-block border border-transparent hover:border-border"
                            onClick={(e) => handleStartEdit(project.id, project.monthlySavingsTarget, e)}
                            title="Cliquez pour modifier"
                          >
                            <span className={`font-medium ${!project.monthlySavingsTarget ? 'text-muted-foreground italic' : ''}`}>
                              {project.monthlySavingsTarget ? 
                                `${project.monthlySavingsTarget.toLocaleString('fr-FR')}€` : 
                                "Cliquez pour définir"
                              }
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {new Date(project.endDate).toLocaleDateString('fr-FR')}
                          </span>
                          <div className="text-sm text-muted-foreground">
                            {monthsRemaining > 0 ? (
                              `${monthsRemaining} mois restant${monthsRemaining > 1 ? 's' : ''}`
                            ) : (
                              "Échéance dépassée"
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!showArchived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewProject(project.id)}
                            className="h-8"
                          >
                            <ArrowUp className="h-3 w-3 mr-1 rotate-45" />
                            Voir détails
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TableProperties className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Tableau des Projets</h1>
          <p className="text-muted-foreground">
            Gérez vos objectifs d'épargne mensuelle pour chaque projet
          </p>
        </div>
      </div>

      <ProjectTable 
        projects={activeProjects} 
        title="Projets actifs" 
      />

      {archivedProjects.length > 0 && (
        <ProjectTable 
          projects={archivedProjects} 
          title="Projets archivés" 
          showArchived={true}
        />
      )}
    </div>
  );
}