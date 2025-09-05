import React, { useState, useEffect } from 'react';
import { Project, ProjectSavingGoal } from '../types/budget';
import { apiFetch } from '../utils/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Calendar, TrendingUp } from 'lucide-react';

interface GoalSavingsProjectionViewProps {
  projects?: Project[];
  showActiveOnly?: boolean;
}

interface MonthProjection {
  month: string; // YYYY-MM format
  displayMonth: string; // format d'affichage
  projects: { [projectId: string]: number }; // montant objectif par projet
}

export const GoalSavingsProjectionView: React.FC<GoalSavingsProjectionViewProps> = ({
  projects = [],
  showActiveOnly = false
}) => {
  const [loading, setLoading] = useState(true);
  const [projections, setProjections] = useState<MonthProjection[]>([]);
  const [projectGoals, setProjectGoals] = useState<{ [projectId: string]: ProjectSavingGoal[] }>({});

  // Fonction pour trouver la date de fin du dernier projet
  const getLastProjectEndDate = (): { month: number, year: number } => {
    const now = new Date();
    let latestMonth = now.getMonth() + 1;
    let latestYear = now.getFullYear();

    const filteredProjects = projects.filter(project => {
      if (!showActiveOnly) return true;
      return !project.archived;
    });

    filteredProjects.forEach(project => {
      if (project.endDate) {
        const endDate = new Date(project.endDate);
        const projectMonth = endDate.getMonth() + 1;
        const projectYear = endDate.getFullYear();
        
        if (projectYear > latestYear || (projectYear === latestYear && projectMonth > latestMonth)) {
          latestMonth = projectMonth;
          latestYear = projectYear;
        }
      }
    });

    return { month: latestMonth, year: latestYear };
  };

  // Fonction pour générer tous les mois du mois courant jusqu'à la fin du dernier projet
  const generateAllMonths = (): MonthProjection[] => {
    const months: MonthProjection[] = [];
    const now = new Date();
    let currentMonth = now.getMonth() + 1;
    let currentYear = now.getFullYear();
    
    const lastDate = getLastProjectEndDate();
    
    // Générer tous les mois jusqu'à la fin du dernier projet
    while (currentYear < lastDate.year || (currentYear === lastDate.year && currentMonth <= lastDate.month)) {
      const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const displayMonth = new Date(currentYear, currentMonth - 1).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit'
      });

      months.push({
        month: monthKey,
        displayMonth,
        projects: {}
      });

      // Passer au mois suivant
      if (currentMonth === 12) {
        currentMonth = 1;
        currentYear++;
      } else {
        currentMonth++;
      }
    }

    return months;
  };

  // Fonction pour récupérer l'objectif applicable pour un projet et un mois
  const getGoalForMonth = (projectId: string, month: string): number => {
    const goals = projectGoals[projectId] || [];
    if (goals.length === 0) return 0;

    const targetDate = month + '-01';
    const activeGoal = goals.find(goal => 
      goal.startDate <= targetDate && 
      (!goal.endDate || goal.endDate >= targetDate)
    );
    
    return activeGoal ? activeGoal.amount : 0;
  };

  // Fonction pour vérifier si un projet est actif pour un mois donné
  const isProjectActiveForMonth = (project: Project, month: string): boolean => {
    const monthDate = month + '-01';
    
    // Vérifier si le projet a commencé
    if (project.startDate > monthDate) return false;
    
    // Vérifier si le projet n'est pas terminé
    if (project.endDate && project.endDate < monthDate) return false;
    
    return true;
  };

  const loadProjectGoals = async () => {
    const goalsCache: { [projectId: string]: ProjectSavingGoal[] } = {};
    
    for (const project of projects) {
      try {
        const response = await apiFetch(`/api/saving-goals/project/${encodeURIComponent(project.id)}`);
        if (response.ok) {
          const goals = await response.json();
          goalsCache[project.id] = goals;
        }
      } catch (e) {
        console.error('Error loading project goals:', e);
        goalsCache[project.id] = [];
      }
    }
    setProjectGoals(goalsCache);
  };

  const calculateProjections = () => {
    const monthsData = generateAllMonths();
    
    // Filtrer les projets selon showActiveOnly
    const filteredProjects = projects.filter(project => {
      if (!showActiveOnly) return true;
      return !project.archived;
    });

    // Pour chaque mois, calculer les objectifs de chaque projet
    const updatedProjections = monthsData.map(monthData => {
      const projectTargets: { [projectId: string]: number } = {};

      filteredProjects.forEach(project => {
        // Vérifier si le projet est actif pour ce mois
        if (isProjectActiveForMonth(project, monthData.month)) {
          const goalAmount = getGoalForMonth(project.id, monthData.month);
          projectTargets[project.id] = goalAmount;
        } else {
          projectTargets[project.id] = 0;
        }
      });

      return {
        ...monthData,
        projects: projectTargets
      };
    });

    setProjections(updatedProjections);
  };

  useEffect(() => {
    if (projects.length > 0) {
      setLoading(true);
      loadProjectGoals().then(() => {
        calculateProjections();
        setLoading(false);
      });
    }
  }, [projects, showActiveOnly]);

  useEffect(() => {
    if (Object.keys(projectGoals).length > 0) {
      calculateProjections();
    }
  }, [projectGoals]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Projection Épargne</h1>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Filtrer les projets selon showActiveOnly
  const filteredProjects = projects.filter(project => {
    if (!showActiveOnly) return true;
    return !project.archived;
  });

  // Calculer les totaux par mois
  const monthlyTotals = projections.map(month => {
    const total = Object.values(month.projects).reduce((sum, amount) => sum + amount, 0);
    return total;
  });

  const grandTotal = monthlyTotals.reduce((sum, total) => sum + total, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Projection Épargne</h1>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {projections.length} mois • Du mois courant à la fin du dernier projet
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Objectifs d'épargne par projet et par mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {/* Tableau simple sans scroll */}
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 font-medium">Projet</th>
                  {projections.map((month) => (
                    <th key={month.month} className="text-center px-2 py-3 font-medium border-l">
                      <div className="text-xs">{month.displayMonth}</div>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-medium border-l">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const projectTotal = projections.reduce((sum, month) => {
                    return sum + (month.projects[project.id] || 0);
                  }, 0);

                  return (
                    <tr key={project.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <div className="max-w-[200px]" title={project.name}>
                          {project.name}
                        </div>
                        {project.archived && (
                          <div className="text-xs text-muted-foreground">Archivé</div>
                        )}
                      </td>
                      {projections.map((month) => {
                        const amount = month.projects[project.id] || 0;
                        const isActive = isProjectActiveForMonth(project, month.month);
                        
                        return (
                          <td key={month.month} className={`px-2 py-3 text-center text-xs border-l ${
                            !isActive ? 'text-muted-foreground bg-muted/20' : ''
                          }`}>
                            {amount > 0 ? formatCurrency(amount) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-medium border-l">
                        {projectTotal > 0 ? formatCurrency(projectTotal) : '-'}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Ligne de total */}
                <tr className="border-t-2 bg-muted/50 font-bold">
                  <td className="px-4 py-3">TOTAL</td>
                  {projections.map((month, index) => (
                    <td key={month.month} className="px-2 py-3 text-center text-xs border-l">
                      {monthlyTotals[index] > 0 ? formatCurrency(monthlyTotals[index]) : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center border-l">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun projet trouvé pour les critères sélectionnés
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Épargne Mensuelle Moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projections.length > 0 ? formatCurrency(grandTotal / projections.length) : '0 €'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Épargne Totale Prévue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(grandTotal)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Période de Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projections.length} mois
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
