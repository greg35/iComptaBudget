import { useState, useEffect } from "react";
import { Project, Transaction, MonthlyData, SavingsAccount, ViewType } from "./types/budget";
import { ProjectsSidebar } from "./components/ProjectsSidebar";
import { ProjectHeader } from "./components/ProjectHeader";
import { BudgetChart } from "./components/BudgetChart";
import { TransactionsList } from "./components/TransactionsList";
import { HomeView } from "./components/HomeView";
import { SettingsView } from "./components/SettingsView";
import { MonthlySavingsView } from "./components/MonthlySavingsView";
import { SidebarProvider } from "./components/ui/sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";

// Projects will be loaded from backend at runtime
// Load savings accounts from backend (accounts under folder 'Disponible')
const defaultSavingsAccounts: SavingsAccount[] = [];


export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [selectedProjectId, setSelectedProjectId] = useState(null as string | null);
  const [projects, setProjects] = useState([] as Project[]);
  const [loadingProjects, setLoadingProjects] = useState(false as boolean);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // fetch projects from backend on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        if (!mounted) return;
        // normalize values to ensure numbers (avoid toLocaleString on null/strings)
        const normalized = (data || []).map((p: any) => ({
          id: String(p.id ?? p.name ?? ''),
          name: p.name ?? String(p.id ?? ''),
          startDate: p.startDate ?? '',
          endDate: p.endDate ?? '',
          plannedBudget: Number(p.plannedBudget ?? 0) || 0,
          currentSavings: Number(p.currentSavings ?? 0) || 0,
          currentSpent: Number(p.currentSpent ?? 0) || 0,
          archived: Boolean(p.archived), // Include archived property from database
          // preserve the original DB project key (string stored in ICTransactionSplit.project)
          dbProject: p.dbProject ?? null,
        } as any));
        setProjects(normalized);
        if (!selectedProjectId && normalized && normalized.length > 0) setSelectedProjectId(String(normalized[0].id));
      } catch (e) {
        console.error('Could not load projects:', e);
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const [projectTransactions, setProjectTransactions] = useState([]);
  const [dropboxUrl, setDropboxUrl] = useState<string>("");

  // Load settings from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:4000/api/settings');
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
  }, []);

  // savings accounts loaded from backend
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>(defaultSavingsAccounts);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/accounts?folder=Disponible&excludeTypes=checking');
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
  }, []);

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
  const projectKey = currentProject && currentProject.dbProject ? currentProject.dbProject : (currentProject && currentProject.id ? currentProject.id : selectedProjectId);
    (async () => {
      try {
        const res = await fetch(`/api/project-transactions?project=${encodeURIComponent(projectKey)}`);
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
          // determine type based on category: only 'Virements d'épargne' is considered savings
          type: ((t.category || '') === 'Virements d\'épargne' || (t.category || '') === "Virements d'épargne") ? 'income' : 'expense',
          category: t.category || ''
        }));
        setProjectTransactions(filtered);
        console.debug('loaded projectTransactions for', projectKey, 'count', filtered.length);
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
        const res = await fetch('/api/projects', {
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
      const response = await fetch(`http://127.0.0.1:4000/api/projects/${projectId}`, {
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
      const response = await fetch(`http://127.0.0.1:4000/api/projects/${projectId}`, {
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
        />
        
        <main className="flex-1 p-6 space-y-6">
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
          ) : selectedProject ? (
            <>
              <ProjectHeader 
                project={selectedProject} 
                onPlannedBudgetChange={(projId, plannedBudget) => {
                  setProjects(prev => prev.map(p => p.id === projId ? Object.assign({}, p, { plannedBudget }) : p));
                }} 
                onDatesChange={handleDatesChange} 
                onArchiveProject={handleArchiveProject}
                onDeleteProject={handleDeleteProject}
              />
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
      </ErrorBoundary>
    </SidebarProvider>
  );
}