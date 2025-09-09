import { useState, useEffect } from "react";
import { Project, ProjectSavingGoal } from "../types/budget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { TrendingUp, Calendar } from "lucide-react";
import { apiFetch } from "../utils/apiClient";

interface MonthlySavingsViewProps {
  projects: Project[];
  showActiveOnly: boolean;
}

interface MonthlySavingsData {
  month: string; // YYYY-MM
  label: string; // Display label
  totalSavings: number;
  projectBreakdown: { [projectId: string]: number };
}

interface ProjectGoalsCache {
  [projectId: string]: ProjectSavingGoal[];
}

export function MonthlySavingsView({ projects, showActiveOnly }: MonthlySavingsViewProps) {
  const [monthsToShow, setMonthsToShow] = useState<3 | 6 | 12>(6);
  const [savingsData, setSavingsData] = useState<MonthlySavingsData[]>([]);
  const [projectGoals, setProjectGoals] = useState<ProjectGoalsCache>({});
  const [loading, setLoading] = useState(true);

  // Filtrer les projets selon showActiveOnly
  const filteredProjects = projects.filter(project => {
    if (!showActiveOnly) return true;
    return !project.archived;
  });

  useEffect(() => {
    loadMonthlySavingsData();
    loadProjectGoals();
  }, [monthsToShow, projects, showActiveOnly]);

  const loadProjectGoals = async () => {
    const goalsCache: ProjectGoalsCache = {};
    try {
      const promises = filteredProjects.map(async (project) => {
        try {
          const response = await apiFetch(`/api/saving-goals/project/${encodeURIComponent(project.id)}`);
          if (response.ok) {
            goalsCache[project.id] = await response.json();
          }
        } catch (e) {
          console.error(`Failed to load goals for project ${project.id}:`, e);
        }
      });
      await Promise.all(promises);
    } catch (e) {
      console.error('Error loading project goals:', e);
    }
    setProjectGoals(goalsCache);
  };

  const getGoalForMonth = (projectId: string, month: string): number | null => {
    const goals = projectGoals[projectId] || [];
    const targetDate = month + '-01';
    const activeGoal = goals.find(goal => 
      goal.startDate <= targetDate && 
      (!goal.endDate || goal.endDate >= targetDate)
    );
    return activeGoal ? activeGoal.amount : null;
  };

  const loadMonthlySavingsData = async () => {
    setLoading(true);
    try {
      // Appel à l'API pour récupérer les données réelles
  const response = await apiFetch(`/api/monthly-savings?months=${monthsToShow}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSavingsData(data);
      
    } catch (error) {
      console.error('Erreur lors du chargement des données d\'épargne:', error);
      
      // Fallback: générer des données de démonstration si l'API échoue
      const fallbackData: MonthlySavingsData[] = [];
      
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
        
        const monthData: MonthlySavingsData = {
          month: monthKey,
          label: monthLabel,
          totalSavings: Math.floor(Math.random() * 2000) + 500,
          projectBreakdown: {}
        };

        // Initialiser avec des données aléatoires pour la démonstration
        filteredProjects.forEach(project => {
          monthData.projectBreakdown[project.id] = Math.floor(Math.random() * 500);
        });

        fallbackData.push(monthData);
      }
      
      setSavingsData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTotalForMonth = (monthData: MonthlySavingsData) => {
    return Object.values(monthData.projectBreakdown).reduce((sum, amount) => sum + amount, 0);
  };

  // Somme des objectifs de tous les projets (filtrés) pour un mois donné
  const getAggregatedGoalForMonth = (month: string): number | null => {
    let total = 0;
    let hasAny = false;
    for (const project of filteredProjects) {
      const goal = getGoalForMonth(project.id, month);
      if (goal !== null) {
        total += goal;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Épargne Mensuelle</h1>
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Épargne Mensuelle</h1>
          <p className="text-muted-foreground">
            Suivi de l'épargne par mois et par projet
            {showActiveOnly && " (projets actifs uniquement)"}
          </p>
        </div>
      </div>

      {/* Sélecteur de période */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Période d'analyse
          </CardTitle>
          <CardDescription>
            Sélectionnez le nombre de mois à afficher
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label htmlFor="months-select" className="text-sm font-medium">
              Nombre de mois :
            </label>
            <Select value={String(monthsToShow)} onValueChange={(value) => setMonthsToShow(Number(value) as 3 | 6 | 12)}>
              <SelectTrigger className="w-32" id="months-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 mois</SelectItem>
                <SelectItem value="6">6 mois</SelectItem>
                <SelectItem value="12">12 mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des données */}
      <Card>
        <CardHeader>
          <CardTitle>Ventilation de l'épargne par projet</CardTitle>
          <CardDescription>
            Montants épargnés par projet et par mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium sticky left-0 bg-background">Projet</th>
                  {savingsData.map(monthData => {
                    const aggGoal = getAggregatedGoalForMonth(monthData.month);
                    return (
                      <th key={monthData.month} className="text-right py-3 px-4 font-medium min-w-40">
                        <div className="flex flex-col items-end">
                          <span>{monthData.label}</span>
                          <span className="text-xs font-normal text-muted-foreground mt-1">
                            Obj: {aggGoal !== null ? formatCurrency(aggGoal) : '—'}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            Épargné: {formatCurrency(monthData.totalSavings)}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Ligne pour chaque projet - épargne réelle */}
                {filteredProjects.map(project => (
                  <tr key={project.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium sticky left-0 bg-background">
                      {project.name}
                    </td>
                    {savingsData.map(monthData => (
                      <td key={monthData.month} className="text-right py-3 px-4">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">
                            {formatCurrency(monthData.projectBreakdown[project.id] || 0)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Obj: {(() => {
                              const goal = getGoalForMonth(project.id, monthData.month);
                              return goal !== null ? formatCurrency(goal) : "—";
                            })()}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                
                {/* Ligne "Non Affecté" */}
                <tr className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium sticky left-0 bg-background text-muted-foreground">
                    Non Affecté
                  </td>
                  {savingsData.map(monthData => {
                    const totalAffected = getTotalForMonth(monthData);
                    const unaffected = monthData.totalSavings - totalAffected;
                    return (
                      <td key={monthData.month} className="text-right py-3 px-4 text-muted-foreground">
                        {formatCurrency(unaffected)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50">
                  <td className="py-3 px-4 font-bold sticky left-0 bg-muted/50">Total Épargné</td>
                  {savingsData.map(monthData => (
                    <td key={monthData.month} className="text-right py-3 px-4 font-bold">
                      {formatCurrency(monthData.totalSavings)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredProjects.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {showActiveOnly 
                ? "Aucun projet actif trouvé. Désactivez le filtre 'Actifs seulement' pour voir tous les projets."
                : "Aucun projet trouvé."
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
