import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/apiClient';
import { Project, ProjectSavingGoal, ProjectAllocation } from '../types/budget';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Calendar, ChevronLeft, ChevronRight, Target, Edit, Save, X, PiggyBank, Wallet, Euro, AlertTriangle, Pencil, Loader2, ArrowDownToLine } from 'lucide-react';

interface SavingsPerMonthProps {
  projects?: Project[];
  showActiveOnly?: boolean;
}

// Composant d'édition inline pour les montants
interface InlineAmountEditorProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  formatValue?: (value: number) => string;
  className?: string;
  placeholder?: string;
}

const InlineAmountEditor: React.FC<InlineAmountEditorProps> = ({
  value,
  onSave,
  formatValue = (v) => v.toString(),
  className = "",
  placeholder = "0"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(value.toString());
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const numValue = parseFloat(editValue) || 0;
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      // En cas d'erreur, on reste en mode édition
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    if (!isSaving) {
      handleSave();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue("");
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Ajustement rapide au clavier
      e.preventDefault();
      const current = parseFloat(editValue || '0') || 0;
      const delta = 1; // incrément par défaut
      const next = e.key === 'ArrowUp' ? current + delta : current - delta;
      setEditValue(next.toString());
    }
  };

  if (isEditing) {
    return (
      <div className="inline-flex items-center">
        <div className="relative inline-flex items-center">
          <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
          <Input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`w-28 h-8 pl-6 pr-6 text-right text-sm rounded-md shadow-sm ${className} focus-visible:ring-0 focus:border-primary`}
            step="0.01"
            placeholder={placeholder}
            disabled={isSaving}
            aria-label="Montant à enregistrer"
          />
          {isSaving && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground/70" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative inline-flex items-center cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role="button"
      aria-label="Modifier le montant"
      title="Cliquer pour modifier"
    >
      <span className="select-none inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-transparent hover:border-border hover:bg-muted/60 transition-colors text-right text-sm leading-none">
        <span>{formatValue(value)}</span>
        <Pencil className="h-3 w-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </div>
  );
};

interface CurrentMonthData {
  month: string;
  totalSavings: number;
  totalMonthlyProjectSpent?: number;
  projectBreakdown: { [projectName: string]: number };
  targetBreakdown: { [projectName: string]: number };
}

export const SavingsPerMonth: React.FC<SavingsPerMonthProps> = ({
  projects = [],
  showActiveOnly = false
}) => {
  const [currentMonthData, setCurrentMonthData] = useState<CurrentMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // État pour l'épargne libre (simplifié)
  const [freeSavings, setFreeSavings] = useState<number>(0);
  
  // Navigation mensuelle
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // État pour les objectifs d'épargne
  const [projectGoals, setProjectGoals] = useState<{ [projectId: string]: ProjectSavingGoal[] }>({});

  // États pour la gestion des allocations (simplifié)
  const [allocations, setAllocations] = useState<{ [key: string]: ProjectAllocation }>({});
  const [autoFillLoading, setAutoFillLoading] = useState<string | null>(null);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Fonction pour récupérer l'objectif applicable pour un projet et un mois
  const getGoalForMonth = (projectId: string, month: string): number | null => {
    const goals = projectGoals[projectId] || [];
    const targetDate = month + '-01';
    const activeGoal = goals.find(goal => 
      goal.startDate <= targetDate && 
      (!goal.endDate || goal.endDate >= targetDate)
    );
    return activeGoal ? activeGoal.amount : null;
  };

  const goToPreviousMonth = () => {
    console.log('Going to previous month from:', selectedMonth, selectedYear);
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    console.log('Going to next month from:', selectedMonth, selectedYear);
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const newMonth = now.getMonth() + 1;
    const newYear = now.getFullYear();
    console.log('Going to current month:', newMonth, newYear);
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  // Fonctions pour gérer les allocations par projet
  const getAllocationKey = (projectId: string, month: string) => `${projectId}-${month}`;

  const getAllocatedAmount = (projectId: string, month: string) => {
    const key = getAllocationKey(projectId, month);
    return allocations[key]?.allocatedAmount || 0;
  };

  // Fonction pour sauvegarder une allocation avec le nouveau composant
  const saveAllocationInline = async (projectId: string, amount: number) => {
    try {
      const response = await apiFetch(`/api/project-allocations/${monthKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocations: [{ projectId, amount }]
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde de l\'allocation');
      }

      // Mettre à jour l'état local
      const key = getAllocationKey(projectId, monthKey);
      setAllocations(prev => ({
        ...prev,
        [key]: {
          id: key,
          projectId,
          month: monthKey,
          allocatedAmount: amount
        }
      }));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'allocation:', error);
      throw error; // Re-lancer l'erreur pour que le composant inline la gère
    }
  };

  // Fonction pour charger les allocations existantes
  const loadAllocations = async () => {
    try {
      const response = await apiFetch(`/api/project-allocations/${monthKey}`);
      if (response.ok) {
        const allocationsArray = await response.json();
        const allocationsMap: { [key: string]: ProjectAllocation } = {};
        
        allocationsArray.forEach((allocation: ProjectAllocation) => {
          const key = getAllocationKey(allocation.projectId, allocation.month);
          allocationsMap[key] = allocation;
        });
        
        setAllocations(allocationsMap);
      } else if (response.status !== 404) {
        console.error('Erreur lors du chargement des allocations:', response.status);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des allocations:', error);
    }
  };

  const handleFillWithTarget = async (projectId: string, monthlyTarget: number) => {
    setAutoFillLoading(projectId);
    try {
      await saveAllocationInline(projectId, monthlyTarget);
    } catch (error) {
      console.error("Erreur lors du remplissage automatique de l'épargne:", error);
    } finally {
      setAutoFillLoading(null);
    }
  };

  const fetchCurrentMonthData = async () => {
    try {
      setLoading(true);
      
      // Récupérer le montant épargné total du mois ET la répartition par projet depuis monthly-savings
      let totalMonthlySavings = 0;
      let totalMonthlyProjectSpent = 0;
      let projectBreakdown: { [projectName: string]: number } = {};
      
      try {
        console.log('Fetching monthly savings for monthKey:', monthKey);
        // Ne récupérer que le mois demandé pour optimiser la performance
        const monthlyResponse = await apiFetch(`/api/monthly-savings?months=1&targetMonth=${monthKey}`);
        if (monthlyResponse.ok) {
          const monthlyData = await monthlyResponse.json();
          console.log('Monthly savings data received:', monthlyData);
          
          // Chercher le mois correspondant dans les données
          const currentMonthEntry = monthlyData.find((entry: any) => {
            console.log('Comparing entry.month:', entry.month, 'with monthKey:', monthKey);
            return entry.month === monthKey;
          });
          
          console.log('Found current month entry:', currentMonthEntry);
          if (currentMonthEntry) {
            totalMonthlySavings = currentMonthEntry.totalSavings || 0;
            totalMonthlyProjectSpent = currentMonthEntry.totalMonthlyProjectSpent || 0;
            projectBreakdown = currentMonthEntry.projectBreakdown || {};
          }
          console.log('totalMonthlySavings set to:', totalMonthlySavings);
          console.log('projectBreakdown set to:', projectBreakdown);
        } else {
          console.error('Monthly savings API response not ok:', monthlyResponse.status);
        }
      } catch (monthlyError) {
        console.warn('Impossible de récupérer les données monthly-savings:', monthlyError);
        totalMonthlySavings = 0;
        projectBreakdown = {};
      }
      
      // Calculer l'épargne affectée aux projets (projectSavings) depuis iCompta
      const projectSavings = Object.values(projectBreakdown).reduce((sum: number, amount: number) => sum + amount, 0);
      
      // Calculer l'épargne libre : totalMonthlySavings - projectSavings
      const calculatedFreeSavings = totalMonthlySavings - projectSavings;
      setFreeSavings(Math.max(0, calculatedFreeSavings)); // Éviter les valeurs négatives
      
      setCurrentMonthData({
        month: monthKey,
        totalSavings: totalMonthlySavings, // Montant épargné total du mois (depuis iCompta)
        totalMonthlyProjectSpent: totalMonthlyProjectSpent,
        projectBreakdown, // Répartition par projet (depuis iCompta)
        targetBreakdown: {}
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      // En cas d'erreur, initialiser avec des données vides
      setCurrentMonthData({
        month: monthKey,
        totalSavings: 0,
        totalMonthlyProjectSpent: 0,
        projectBreakdown: {},
        targetBreakdown: {}
      });
    } finally {
      setLoading(false);
    }
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
      }
    }
    setProjectGoals(goalsCache);
  };

  useEffect(() => {
    console.log('SavingsPerMonth useEffect triggered:', {
      projectsLength: projects.length,
      showActiveOnly,
      selectedMonth,
      selectedYear,
      monthKey
    });
    if (projects.length > 0) {
      fetchCurrentMonthData();
      loadProjectGoals();
      loadAllocations();
    }
  }, [projects, showActiveOnly, selectedMonth, selectedYear]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Épargne par Mois</h1>
          </div>
          <div className="flex items-center justify-between w-[32rem] min-w-[32rem]">
            <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0 flex-shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center px-4">
              <span className="text-lg font-medium whitespace-nowrap">
                {selectedMonth}/{selectedYear}
              </span>
            </div>
            <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0 flex-shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filtrer les projets selon showActiveOnly
  const filteredProjects = projects.filter(project => {
    if (!showActiveOnly) return true;
    return !project.archived;
  });

  // Calculer les données pour chaque projet
  const projectTargets = filteredProjects.map(project => {
    // Récupérer l'objectif mensuel depuis la table project_saving_goals
    const monthlyTarget = getGoalForMonth(project.id, monthKey) || 0;
    
    // Utiliser l'allocation manuelle si elle existe, sinon utiliser les données iCompta
    const allocatedAmount = getAllocatedAmount(project.id, monthKey);
    const icomptaAmount = currentMonthData?.projectBreakdown 
      ? (currentMonthData.projectBreakdown[project.name] || 0)
      : 0;
    
    // Priorité à l'allocation manuelle si elle existe (> 0), sinon utiliser iCompta
    const currentSavings = allocatedAmount > 0 ? allocatedAmount : icomptaAmount;
    const currentSpent = project.currentSpent || 0;
    
    const difference = currentSavings - monthlyTarget;
    const isTargetMet = difference >= 0;

    return {
      projectId: project.id,
      projectName: project.name,
      monthlyTarget,
      currentSavings,
      currentSpent,
      difference,
      isTargetMet
    };
  });

  const totalTarget = projectTargets.reduce((sum, target) => sum + target.monthlyTarget, 0);
  
  // IMPORTANT: Distinction entre les deux types d'épargne
  // 1. totalMonthlySavings = Montant épargné total du mois (depuis iCompta)
  const totalMonthlySavings = currentMonthData?.totalSavings || 0;
  
  // 2. projectSavings = Montant affecté aux projets (depuis savings-amounts)
  const projectSavings = projectTargets.reduce((sum, target) => sum + target.currentSavings, 0);
  const projectSpent = projectTargets.reduce((sum, target) => sum + target.currentSpent, 0);
  const totalMonthlyProjectSpent = currentMonthData?.totalMonthlyProjectSpent || 0;

  const totalDifference = totalMonthlySavings - projectSavings;
  const overallTargetMet = totalDifference >= 0;

  console.log('ProjectTargets:', projectTargets.length, projectTargets.map(t => t.projectName));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Épargne par Mois</h1>
        </div>
        
        {/* Navigation des mois */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-lg font-medium min-w-[200px] text-center">
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('fr-FR', { 
              year: 'numeric', 
              month: 'long' 
            })}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentMonth}
            className="ml-2"
          >
            Aujourd'hui
          </Button>
        </div>
      </div>

      {currentMonthData && (
        <div className="space-y-6">
          <div className="home-cols-4">
            <div>
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm">Montant Épargné Total</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl flex items-center gap-2 ${totalMonthlySavings < 0 ? 'text-red-600' : ''}`}>
                    {totalMonthlySavings < 0 && <AlertTriangle className="h-6 w-6" />}
                    {formatCurrency(totalMonthlySavings)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total épargné du mois (depuis iCompta)</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm">Objectif Total</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatCurrency(totalTarget)}</div>
                  <p className="text-xs text-muted-foreground">Montant épargné attendu pour le mois</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm">Épargne Projets</CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatCurrency(projectSavings)}</div>
                  <p className="text-xs text-muted-foreground">{(projectSavings/totalMonthlySavings*100).toFixed(1)}% affecté aux projets</p>
                  </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm">Reste à attribuer</CardTitle>
                  <Euro className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl flex items-center gap-2 ${totalDifference < 0 ? 'text-red-600' : ''}`}>
                    {totalDifference < 0 && <AlertTriangle className="h-6 w-6" />}
                    {formatCurrency(totalDifference)}
                  </div>
                  <p className="text-xs text-muted-foreground">{(totalDifference/totalMonthlySavings*100).toFixed(1)}% attribué au fond d'urgence</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Table des projets avec espacement amélioré */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 font-medium">Projet</th>
                  <th className="text-left px-6 py-3 font-medium">Objectif Mensuel</th>
                  <th className="text-left px-6 py-3 font-medium">Épargne Réalisée</th>
                  <th className="text-right px-6 py-3 font-medium">Différence</th>
                  <th className="text-center px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {projectTargets.map((target) => (
                  <tr key={target.projectId} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{target.projectName}</td>
                    <td className="px-6 py-3 text-left">{formatCurrency(target.monthlyTarget)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <InlineAmountEditor
                          value={target.currentSavings}
                          onSave={(amount) => saveAllocationInline(target.projectId, amount)}
                          formatValue={(value) => formatCurrency(value)}
                          className="text-right"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleFillWithTarget(target.projectId, target.monthlyTarget)}
                          disabled={autoFillLoading === target.projectId}
                          title="Renseigner l'épargne réalisée avec l'objectif mensuel"
                          aria-label="Renseigner l'épargne réalisée avec l'objectif mensuel"
                        >
                          {autoFillLoading === target.projectId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowDownToLine className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className={`px-6 py-3 text-right font-medium ${
                      target.isTargetMet ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {target.difference >= 0 ? '+' : ''}{formatCurrency(target.difference)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        target.isTargetMet 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <Target className="h-3 w-3" />
                        {target.isTargetMet ? 'Atteint' : 'En retard'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50">
                  <td className="px-4 py-3 font-bold">TOTAL</td>
                  <td className="px-6 py-3 text-left font-bold">{formatCurrency(totalTarget)}</td>
                  <td className="px-6 py-3 text-left font-bold">{formatCurrency(projectSavings)}</td>
                  <td className={`px-6 py-3 text-right font-bold ${
                    (projectSavings - totalTarget) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(projectSavings - totalTarget) >= 0 ? '+' : ''}{formatCurrency(projectSavings - totalTarget)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      (projectSavings - totalTarget) >= 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <Target className="h-3 w-3" />
                      {(projectSavings - totalTarget) >= 0 ? 'Objectifs atteints' : 'Objectifs non atteints'}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="home-cols-4">
            <div>
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm">Provision à prévoir</CardTitle>
                  <Euro className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl flex items-center gap-2">
                    {formatCurrency(totalMonthlyProjectSpent)}
                  </div>
                  {/* <p className="text-xs text-muted-foreground">{(projectSpent/totalMonthlySavings*100).toFixed(1)}% attribué au fond d'urgence</p> */}
                </CardContent>
              </Card>
            </div>
          </div>

          {projectTargets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun projet trouvé pour les critères sélectionnés
            </div>
          )}
        </div>
      )}
    </div>
  );
};
