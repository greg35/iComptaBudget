import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ProjectSavingGoal, SavingGoalSuggestion, ProjectMonthlyGoalPerformance, Project } from '../types/budget';
import { RefreshCw, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { SavingGoalsSparkline } from './SavingGoalsSparkline';

interface Props {
  projectId: string;
}

export function ProjectSavingGoalsPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ProjectSavingGoal[]>([]);
  const [suggestion, setSuggestion] = useState<SavingGoalSuggestion | null>(null);
  const [performance, setPerformance] = useState<ProjectMonthlyGoalPerformance | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const todayMonth = new Date().toISOString().slice(0,7);

  const fmt = (n?: number | null) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n||0));

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [histRes, suggRes, perfRes, projectsRes] = await Promise.all([
        fetch(`/api/saving-goals/project/${encodeURIComponent(projectId)}`),
        fetch(`/api/saving-goals/project/${encodeURIComponent(projectId)}/suggest`, { method: 'POST' }),
        fetch(`/api/saving-goals/project/${encodeURIComponent(projectId)}/month/${todayMonth}`),
        fetch('/api/projects')
      ]);
      if (!histRes.ok) throw new Error('hist');
      const hist = await histRes.json();
      setHistory(hist);
      if (suggRes.ok) setSuggestion(await suggRes.json()); else setSuggestion(null);
      if (perfRes.ok) setPerformance(await perfRes.json()); else setPerformance(null);
      if (projectsRes.ok) {
        const allProjects = await projectsRes.json();
        const found = (allProjects || []).find((p: any) => String(p.id) === String(projectId));
        if (found) {
          setProjectData({
            id: String(found.id ?? found.name ?? ''),
            name: found.name ?? String(found.id ?? ''),
            startDate: found.startDate || '',
            endDate: found.endDate || '',
            plannedBudget: Number(found.plannedBudget || 0) || 0,
            currentSavings: Number(found.currentSavings || 0) || 0,
            currentSpent: Number(found.currentSpent || 0) || 0,
            archived: Boolean(found.archived),
            dbProject: found.dbProject ?? null,
          });
        } else {
          setProjectData(null);
        }
      }
    } catch (e:any) {
      console.error(e);
      setError('Erreur chargement objectifs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [projectId]);

  async function acceptSuggestion() {
    if (!suggestion) return;
    setAccepting(true); setError(null);
    try {
      const res = await fetch(`/api/saving-goals/project/${encodeURIComponent(projectId)}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newAmount: suggestion.suggestedGoal, reason: `auto-adjust (${suggestion.status})` })
      });
      if (!res.ok) throw new Error('accept failed');
      await loadAll();
    } catch (e:any) {
      setError('Echec enregistrement');
    } finally {
      setAccepting(false);
    }
  }

  function renderStatusBadge() {
    if (!suggestion) return null;
    const map: Record<string,{label:string;variant?:string}> = {
      ahead: { label: 'En avance', variant: 'default' },
      behind: { label: 'En retard', variant: 'destructive' },
      on_track: { label: 'Dans les temps', variant: 'secondary' },
      completed: { label: 'Objectif atteint', variant: 'outline' }
    };
    const info = map[suggestion.status];
    if (!info) return null;
    return <Badge variant={info.variant as any}>{info.label}</Badge>;
  }

  function renderPerfBadge() {
    if (!performance) return null;
    const st = performance.status;
    if (st === 'no_goal') return <Badge variant="outline">Pas d'objectif</Badge>;
    if (st === 'over') return <Badge variant="default">Au-dessus</Badge>;
    if (st === 'under') return <Badge variant="destructive">En dessous</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  }

  const currentGoal = history.find(g => !g.endDate);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Target className="h-4 w-4" /> Objectifs d'épargne
        </CardTitle>
        <div className="flex items-center gap-2">
          {renderStatusBadge()}
          {renderPerfBadge()}
          <Button variant="ghost" size="sm" onClick={loadAll} disabled={loading} title="Rafraîchir">
            <RefreshCw className={`h-4 w-4 ${loading? 'animate-spin':''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoBlock icon={<Target className="h-4 w-4" />} label="Objectif courant" value={currentGoal ? fmt(currentGoal.amount)+'€' : '—'} />
          <InfoBlock icon={<TrendingUp className="h-4 w-4" />} label="Suggestion" value={suggestion ? fmt(suggestion.suggestedGoal)+'€' : '—'} />
          <InfoBlock
            icon={<TrendingDown className="h-4 w-4" />}
            label="Reste à épargner"
            value={projectData ? (() => {
              const remaining = (projectData.plannedBudget || 0) - (projectData.currentSavings || 0);
              return remaining > 0 ? fmt(remaining) + '€' : '0€';
            })() : '—'}
          />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowDetails(d => !d)}>
            {showDetails ? 'Masquer les détails' : '+ de détail'}
          </Button>
        </div>
        {showDetails && (
          <div className="space-y-4">
            <div className="pt-2">
              <SavingGoalsSparkline goals={history} />
            </div>
            {performance && (
              <div className="text-sm text-muted-foreground">
                Mois {performance.month}: objectif {performance.goal != null ? fmt(performance.goal)+'€' : '—'}, réalisé {fmt(performance.actualSavings)}€, écart {performance.delta != null ? fmt(performance.delta)+'€' : '—'}
              </div>
            )}
            {suggestion && currentGoal && Math.abs(suggestion.suggestedGoal - currentGoal.amount) < 0.01 && (
              <div className="text-xs text-muted-foreground">Suggestion identique à l'objectif actuel.</div>
            )}
            {suggestion && suggestion.status !== 'completed' && (!currentGoal || Math.abs(suggestion.suggestedGoal - currentGoal.amount) >= 0.01) && (
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="text-sm">
                  Ajuster l'objectif de {currentGoal ? fmt(currentGoal.amount)+'€' : '—'} à <strong>{fmt(suggestion.suggestedGoal)}€</strong>
                </div>
                <Button size="sm" onClick={acceptSuggestion} disabled={accepting}>{accepting ? 'Enregistrement...' : 'Accepter'}</Button>
              </div>
            )}
            {suggestion?.status === 'completed' && (
              <div className="text-xs text-green-600 font-medium">Objectif global atteint. Plus d'ajustement nécessaire.</div>
            )}
            <div>
              <h4 className="text-sm font-semibold mb-2">Historique</h4>
              <div className="space-y-2 max-h-64 overflow-auto pr-2 text-sm">
                {history.length === 0 && <div className="text-muted-foreground">Aucun objectif</div>}
                {history.map(g => (
                  <div key={g.id} className="flex items-center justify-between border rounded px-2 py-1">
                    <div className="flex flex-col">
                      <span>{fmt(g.amount)}€ {g.reason && <span className="text-xs text-muted-foreground">({g.reason})</span>}</span>
                      <span className="text-xs text-muted-foreground">{g.startDate} → {g.endDate || 'en cours'}</span>
                    </div>
                    {!g.endDate && <Badge variant="outline">Actif</Badge>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoBlock({ icon, label, value }: { icon: any; label: string; value: string; }) {
  return (
    <div className="p-3 rounded border bg-muted/20 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="text-base font-medium">{value}</div>
    </div>
  );
}
