import { useState, useEffect } from "react";
import { Project, Transaction, MonthlyData, SavingsAccount, ViewType } from "./types/budget";
import { ProjectsSidebar } from "./components/ProjectsSidebar";
import { ProjectHeader } from "./components/ProjectHeader";
import { ProjectSavingGoalsPanel } from "./components/ProjectSavingGoalsPanel";
import { BudgetChart } from "./components/BudgetChart";
import { TransactionsList } from "./components/TransactionsList";
import { HomeView } from "./components/HomeView";
import { GlobalSavingsFooter } from "./components/GlobalSavingsFooter";
import { SettingsView } from "./components/SettingsView";
import { MonthlySavingsView } from "./components/MonthlySavingsView";
import { MonthBreakdownView } from "./components/MonthBreakdownView";
import { GoalSavingsProjectionView } from "./components/GoalSavingsProjectionView";
import { FirstStartupView } from "./components/FirstStartupView";
import { SidebarProvider } from "./components/ui/sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { ProjectsTableView } from "./components/ProjectsTableView";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { LoginForm } from "./components/LoginForm";
import { toast } from "sonner";
import { updateAccounts } from "./utils/accountsApi";
import { apiFetch } from "./utils/apiClient";

// Projects will be loaded from backend at runtime
// Load savings accounts from backend (accounts under folder 'Disponible')
const defaultSavingsAccounts: SavingsAccount[] = [];

// Composant principal de l'application avec authentification
function MainApp() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return <BudgetApp />;
}

// Composant pour gérer l'authentification
function AuthView() {
  const { login, register, loading, error, checkUser } = useAuth();
  const [isFirstUser, setIsFirstUser] = useState<boolean | null>(null);

  useEffect(() => {
    const checkFirstUser = async () => {
      const hasUser = await checkUser();
      setIsFirstUser(!hasUser);
    };
    checkFirstUser();
  }, [checkUser]);

  if (isFirstUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <LoginForm
      onLogin={login}
      onRegister={register}
      loading={loading}
      error={error}
      isFirstUser={isFirstUser}
    />
  );
}

// Composant principal du budget (après authentification)
function BudgetApp() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [selectedProjectId, setSelectedProjectId] = useState(null as string | null);
  const [projects, setProjects] = useState([] as Project[]);
  const [loadingProjects, setLoadingProjects] = useState(false as boolean);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isFirstStartup, setIsFirstStartup] = useState<boolean | null>(null);
  const [checkingFirstStartup, setCheckingFirstStartup] = useState(true);
  const [isUpdatingAccounts, setIsUpdatingAccounts] = useState(false);

  // Check if this is first startup (no database exists)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Use the dedicated first startup detection endpoint
  const res = await apiFetch('/api/first-startup');
        if (!mounted) return;
        
        if (res.ok) {
          const data = await res.json();
          console.log('First startup check:', data);
          setIsFirstStartup(data.isFirstStartup);
        } else {
          // If endpoint fails, assume it's first startup
          console.log('First startup endpoint failed, assuming first startup');
          setIsFirstStartup(true);
        }
      } catch (e) {
        console.error('Error checking first startup:', e);
        // If we can't reach the backend, assume it's first startup
        if (mounted) setIsFirstStartup(true);
      } finally {
        if (mounted) setCheckingFirstStartup(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
  const res = await apiFetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      
      // Charger les objectifs d'épargne et les allocations pour tous les projets
      const projectsWithTargets = await Promise.all((data || []).map(async (p: any) => {
        const normalized: Project = {
          id: String(p.id ?? p.name ?? ''),
          name: p.name ?? String(p.id ?? ''),
          startDate: p.startDate ?? '',
          endDate: p.endDate ?? '',
          plannedBudget: Number(p.plannedBudget ?? 0) || 0,
          currentSavings: Number(p.currentSavings ?? 0) || 0, // This is only iCompta transactions
          currentSpent: Number(p.currentSpent ?? 0) || 0,
          archived: Boolean(p.archived),
          dbProject: p.dbProject ?? null,
        };

        // Récupérer l'objectif d'épargne mensuel le plus récent
        try {
          const goalsRes = await apiFetch(`/api/saving-goals/project/${normalized.id}`);
          if (goalsRes.ok) {
            const goals = await goalsRes.json();
            // Trouver l'objectif actif (celui sans endDate ou avec la endDate la plus récente)
            const activeGoal = goals
              .filter((goal: any) => !goal.endDate || new Date(goal.endDate) >= new Date())
              .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
            
            if (activeGoal) {
              normalized.monthlySavingsTarget = Number(activeGoal.amount) || 0;
            }
          }
        } catch (e) {
          // Si on ne peut pas charger les objectifs, on continue sans
          console.warn(`Could not load saving goals for project ${normalized.id}:`, e);
        }

        return normalized;
      }));

      setProjects(projectsWithTargets);
      if (!selectedProjectId && projectsWithTargets && projectsWithTargets.length > 0) {
        setSelectedProjectId(String(projectsWithTargets[0].id));
      }
    } catch (e) {
      console.error('Could not load projects:', e);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fonction pour recharger currentSavings d'un projet après une allocation
  const refreshProjectSavings = async (projectId: string) => {
    try {
      // Récupérer les données du projet depuis l'API
  const res = await apiFetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      const projectData = data.find((p: any) => String(p.id) === projectId);
      if (!projectData) return;

      // Calculer currentSavings avec allocations manuelles
      let currentSavings = Number(projectData.currentSavings ?? 0) || 0;
      
      try {
        const transactionsRes = await fetch(`/api/transactions?project=${projectId}`);
        if (transactionsRes.ok) {
          const transactions = await transactionsRes.json();
          // Filtrer uniquement les transactions d'allocation créées par notre système
          // (description commence par "VIR Epargne" ET isManual = true)
          const manualAllocations = transactions
            .filter((t: any) => 
              t.type === 'income' && 
              t.category === "Virements d'épargne" &&
              t.description && t.description.startsWith('VIR Epargne') &&
              t.isManual === true // Exclure les vraies transactions iCompta déjà comptées
            )
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
          currentSavings += manualAllocations;
        }
      } catch (e) {
        console.warn(`Could not load manual allocations for project ${projectId}:`, e);
      }

      // Mettre à jour le projet dans l'état local
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, currentSavings } : p
      ));
    } catch (e) {
      console.error('Could not refresh project savings:', e);
    }
  };

  // fetch projects from backend on mount
  useEffect(() => {
    let mounted = true;
    // Only fetch projects if it's not first startup
    if (isFirstStartup === true) return;
    
    (async () => {
      if (mounted) {
        await loadProjects();
      }
    })();
    return () => { mounted = false; };
  }, [isFirstStartup]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const [projectTransactions, setProjectTransactions] = useState([]);
  const [dropboxUrl, setDropboxUrl] = useState<string>("");

  // Load settings from backend
  useEffect(() => {
    let mounted = true;
    // Only load settings if it's not first startup
    if (isFirstStartup === true) return;
    
    (async () => {
      try {
  const res = await apiFetch('/api/settings');
        if (!res.ok) throw new Error('failed to fetch settings');
        const data = await res.json();
        if (!mounted) return;
        if (data.dropbox_url) {
          setDropboxUrl(data.dropbox_url);
        }
      } catch (e) {
        console.warn('Could not load settings:', e);
      }
    })();
    return () => { mounted = false; };
  }, [isFirstStartup]);

  // savings accounts loaded from backend
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>(defaultSavingsAccounts);
  useEffect(() => {
    let mounted = true;
    // Only load savings accounts if it's not first startup
    if (isFirstStartup === true) return;
    
    (async () => {
      try {
  const res = await apiFetch('/api/accounts?filterType=savings');
        if (!res.ok) throw new Error('failed to fetch accounts');
        const data = await res.json();
        if (!mounted) return;
        const normalized = (data || []).map((a: any) => ({
          id: String(a.id ?? a.ID ?? a.name ?? ''),
          name: a.name || a.Name || String(a.id || ''),
          balance: Number(a.balance ?? a.Balance ?? 0) || 0,
          type: (a.type || 'autre') as any,
        } as SavingsAccount));
        setSavingsAccounts(normalized);
      } catch (e) {
        console.warn('Could not load accounts, falling back to empty list', e);
        setSavingsAccounts(defaultSavingsAccounts);
      }
    })();
    return () => { mounted = false; };
  }, [isFirstStartup]);

  // fetch transactions for selected project
  useEffect(() => {
    let mounted = true;
    if (!selectedProjectId) {
      setProjectTransactions([]);
      return;
    }
  const currentProject = projects.find(p => p.id === selectedProjectId);
  // Use the DB project key (dbProject) when available — this matches ICTransactionSplit.project values
  // Fallback to the project id when dbProject is not set.
  //const projectKey = currentProject && currentProject.dbProject ? currentProject.dbProject : (currentProject && currentProject.id ? currentProject.id : selectedProjectId);
  const projectKey = selectedProjectId;
    (async () => {
      try {
  const res = await apiFetch(`/api/transactions?project=${encodeURIComponent(projectKey)}`);
        if (!res.ok) throw new Error('failed to fetch project transactions');
        const data = await res.json();
        if (!mounted) return;
        const filtered = (data || []).filter((t: any) => {
          const cat = (t.category || '').toString().toLowerCase();
          // filter out provisions at client-side as well
          return !cat.includes('provision');
        }).map((t: any) => ({
          id: String(t.id),
          projectId: selectedProjectId,
          date: t.txDate || t.date || '',
          description: t.description || '',
          comment: t.comment || '',
          amount: Number(t.amount || 0),
          // Use original type if available (for manual transactions), otherwise determine from category
          type: t.type || (((t.category || '') === 'Virements d\'épargne' || (t.category || '') === "Virements d'épargne") ? 'income' : 'expense'),
          category: t.category || ''
        }));
        setProjectTransactions(filtered);        
      } catch (e: any) {
        console.error('could not load project transactions', e);
        setProjectTransactions([]);
      }
    })();
    return () => { mounted = false; };
  }, [selectedProjectId]);
    // build monthly cumulative chart data from projectTransactions and project dates
    const buildMonthlyCumulative = (transactions: any[], project: any): MonthlyData[] => {
    if (!project) return [];
    // parse transaction dates and classify savings vs expenses (projectTransactions already sets type)
    const txs = (transactions || []).map(t => ({
      date: t.date ? new Date(t.date) : null,
      amount: Number(t.amount || 0),
      type: t.type || 'expense'
    })).filter(t => t.date && !isNaN(t.date.getTime()));

    if (txs.length === 0) return [];

    // determine start and end
    const txDates = txs.map(t => (t.date as Date).getTime());
    const firstTx = new Date(Math.min(...txDates));
    const lastTx = new Date(Math.max(...txDates));
    const startDate = project.startDate ? new Date(project.startDate) : firstTx;
    const endDate = project.endDate ? new Date(project.endDate) : lastTx;

    // normalize to first day of month
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

    // monthly sums (not cumulative yet)
    const monthly = new Map();
    for (const t of txs) {
      const dt = t.date as Date;
      const k = monthKey(new Date(dt.getFullYear(), dt.getMonth(), 1));
      const cur = monthly.get(k) || { savings: 0, spent: 0 };
      if (t.type === 'income') cur.savings += Number(t.amount || 0);
      else cur.spent += Math.abs(Number(t.amount || 0));
      monthly.set(k, cur);
    }

    // iterate months and build cumulative
    const out: MonthlyData[] = [];
    let cur = new Date(start.getTime());
    let cumSavings = 0;
    let cumSpent = 0;
    while (cur.getTime() <= end.getTime()) {
      const k = monthKey(cur);
      const m = monthly.get(k) || { savings: 0, spent: 0 };
      cumSavings += m.savings;
      cumSpent += m.spent;
      // label as localized short month (e.g., 'sept. 2024')
      const label = cur.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
      out.push({ month: k, label, savings: Number(cumSavings.toFixed(2)), spent: Number(cumSpent.toFixed(2)) });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  };

  const chartData = selectedProjectId ? buildMonthlyCumulative(projectTransactions, selectedProject) : [];
  console.debug('chartData debug', chartData);

  const handleDatesChange = (projectId: string, dates: { startDate?: string | null, endDate?: string | null }) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, startDate: dates.startDate ?? p.startDate, endDate: dates.endDate ?? p.endDate } : p));
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentView("project");
  };

  const handleCreateProject = (projectData: Omit<Project, 'id' | 'currentSavings' | 'currentSpent'>) => {
    (async () => {
      try {
        const body = {
          name: projectData.name,
          startDate: projectData.startDate || null,
          endDate: projectData.endDate || null,
          plannedBudget: Number(projectData.plannedBudget || 0) || 0
        };
  const res = await apiFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('failed to create project');
        const data = await res.json();
        const proj = (data && data.project) ? data.project : null;
        let normalizedProject: Project;
        if (proj) {
          normalizedProject = {
            id: String(proj.id ?? Math.random().toString(36).substr(2,9)),
            name: proj.name || projectData.name,
            startDate: proj.startDate || projectData.startDate || '',
            endDate: proj.endDate || projectData.endDate || '',
            plannedBudget: Number(proj.plannedBudget ?? projectData.plannedBudget ?? 0) || 0,
            currentSavings: 0,
            currentSpent: 0,
            dbProject: proj.name ?? null,
          } as Project;
        } else {
          // fallback to local optimistic project
          normalizedProject = {
            id: Math.random().toString(36).substr(2, 9),
            name: projectData.name,
            startDate: projectData.startDate || '',
            endDate: projectData.endDate || '',
            plannedBudget: Number(projectData.plannedBudget || 0) || 0,
            currentSavings: 0,
            currentSpent: 0,
            dbProject: null,
          } as Project;
        }
        setProjects(prev => [...prev, normalizedProject]);
        setSelectedProjectId(normalizedProject.id);
        toast.success(`Projet "${normalizedProject.name}" créé et sauvegardé.`);
      } catch (e: any) {
        console.error('failed to create project on server', e);
        toast.error('Échec de la création du projet');
      }
    })();
  };

  const handleArchiveProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newArchivedState = !project.archived;
    
    try {
      // Call backend to update archived state
  const response = await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: newArchivedState }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // Update local state with the response from server
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId 
            ? { ...p, archived: result.project?.archived ?? newArchivedState } 
            : p
        )
      );

      toast.success(
        newArchivedState 
          ? `Projet "${project.name}" archivé avec succès !`
          : `Projet "${project.name}" désarchivé avec succès !`
      );

      // Si le projet archivé était sélectionné, retourner à l'accueil
      if (newArchivedState && selectedProjectId === projectId) {
        setCurrentView("home");
        setSelectedProjectId(null);
      }
    } catch (error) {
      console.error('Failed to update project archived state:', error);
      toast.error('Échec de la mise à jour du statut d\'archivage');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    try {
      // Call backend to delete project
  const response = await apiFetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // Update local state - remove the project
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      
      toast.success(`Projet "${project.name}" supprimé avec succès !`);

      // Si le projet supprimé était sélectionné, retourner à l'accueil
      if (selectedProjectId === projectId) {
        setCurrentView("home");
        setSelectedProjectId(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Échec de la suppression du projet');
    }
  };

  const handleUpdateDropboxUrl = (url: string) => {
    setDropboxUrl(url);
  };

  const handleUpdateAccounts = async () => {
    setIsUpdatingAccounts(true);
    try {
      const success = await updateAccounts({
        requireDropboxUrl: true,
        dropboxUrl: dropboxUrl
      });
      if (success) {
        // Reload projects after updating accounts
        loadProjects();
      }
    } finally {
      setIsUpdatingAccounts(false);
    }
  };
  const handleUpdateProject = async (
    projectId: string,
    updates: Partial<Project>,
  ) => {
    // Mettre à jour l'état local immédiatement
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, ...updates }
          : project,
      ),
    );

    // Si monthlySavingsTarget est modifié, sauvegarder comme objectif d'épargne
    if ('monthlySavingsTarget' in updates && updates.monthlySavingsTarget !== undefined) {
      try {
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
        
  const response = await apiFetch('/api/saving-goals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            amount: updates.monthlySavingsTarget,
            startDate: currentMonth,
            reason: 'Modification manuelle depuis le tableau des projets',
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la sauvegarde de l\'objectif d\'épargne');
        }

        console.log('Objectif d\'épargne mensuel sauvegardé:', updates.monthlySavingsTarget);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'objectif d\'épargne:', error);
        // Note: On garde la mise à jour locale même en cas d'erreur de sauvegarde
      }
    }
  };

  const handleFirstStartupComplete = () => {
    setIsFirstStartup(false);
    // Force reload of all data after first startup is complete
    window.location.reload();
  };

  // Show loading while checking if it's first startup
  if (checkingFirstStartup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show first startup view if this is the first time
  if (isFirstStartup) {
    return (
      <>
        <FirstStartupView onComplete={handleFirstStartupComplete} />
        <Toaster />
      </>
    );
  }
  return (
    <SidebarProvider>
      <ErrorBoundary>
      <div className="min-h-screen flex w-full">
        <ProjectsSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          currentView={currentView}
          showActiveOnly={showActiveOnly}
          onProjectSelect={handleProjectSelect}
          onViewChange={handleViewChange}
          onCreateProject={handleCreateProject}
          onShowActiveOnlyChange={setShowActiveOnly}
          onUpdateAccounts={handleUpdateAccounts}
          isUpdatingAccounts={isUpdatingAccounts}
        />
        
  <main className={`flex-1 p-6 space-y-6 flex flex-col ${ (currentView === 'projects-table' || currentView === 'monthly-savings' || currentView === 'month-breakdown') ? 'pb-28' : '' }`}>
          {currentView === "home" ? (
            <HomeView
              projects={projects}
              savingsAccounts={savingsAccounts}
            />
          ) : currentView === "settings" ? (
            <SettingsView
              dropboxUrl={dropboxUrl}
              onUpdateDropboxUrl={handleUpdateDropboxUrl}
            />
          ) : currentView === "monthly-savings" ? (
            <MonthlySavingsView
              projects={projects}
              showActiveOnly={showActiveOnly}
            />
          ) : currentView === "month-breakdown" ? (
            <MonthBreakdownView
              projects={projects}
              showActiveOnly={showActiveOnly}
            />
          ) : currentView === "projection-epargne" ? (
            <GoalSavingsProjectionView
              projects={projects}
              showActiveOnly={showActiveOnly}
            />
          ) : currentView === "projects-table" ? (
            <ProjectsTableView
              projects={projects}
              onUpdateProject={handleUpdateProject}
              onProjectSelect={handleProjectSelect}
              onViewChange={handleViewChange}
            />
          ): selectedProject ? (
            <>
              <ProjectHeader 
                project={selectedProject} 
                onPlannedBudgetChange={(projId, plannedBudget) => {
                  setProjects(prev => prev.map(p => p.id === projId ? Object.assign({}, p, { plannedBudget }) : p));
                }} 
                onDatesChange={handleDatesChange} 
                onArchiveProject={handleArchiveProject}
                onDeleteProject={handleDeleteProject}
                onNameChange={(projId, name) => {
                  setProjects(prev => prev.map(p => p.id === projId ? Object.assign({}, p, { name }) : p));
                }}
              />
              <ProjectSavingGoalsPanel projectId={selectedProject.id} />
              <BudgetChart data={chartData} projectName={selectedProject.name} />
              <TransactionsList transactions={projectTransactions} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Sélectionnez un projet pour voir les détails</p>
            </div>
          )}
        </main>
      </div>
      {(currentView === 'projects-table' || currentView === 'monthly-savings' || currentView === 'month-breakdown') && (
        <GlobalSavingsFooter projects={projects} savingsAccounts={savingsAccounts} />
      )}
      <Toaster />
      </ErrorBoundary>
    </SidebarProvider>
  );
}

// Composant racine avec le provider d'authentification
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}