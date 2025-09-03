import { Project } from "../types/budget";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useState, useRef, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Calendar, Target, TrendingUp, TrendingDown, Edit3, Edit, Check, X, Save, MoreHorizontal, Archive, Trash2 } from "lucide-react";

interface ProjectHeaderProps {
  project: Project;
  onPlannedBudgetChange?: (projectId: string, plannedBudget: number) => void;
  onDatesChange?: (projectId: string, dates: { startDate?: string | null, endDate?: string | null }) => void;
  onArchiveProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onNameChange?: (projectId: string, name: string) => void;
}

export function ProjectHeader({ project, onPlannedBudgetChange, onDatesChange, onArchiveProject, onDeleteProject, onNameChange }: ProjectHeaderProps) {
  const safeNum = (v?: number | null) => Number(v ?? 0);
  const fmt = (v?: number | null) => new Intl.NumberFormat('fr-FR').format(safeNum(v));
  const planned = safeNum(project.plannedBudget);
  const progressPercentage = planned === 0 ? 0 : (safeNum(project.currentSavings) / planned) * 100;
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const safeDate = (d?: string | null) => {
    try {
      if (!d) return 'N/A';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return 'N/A';
      return dt.toLocaleDateString('fr-FR');
    } catch {
      return 'N/A';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <NameEditor project={project} onChange={onNameChange} />
              {project.archived && (
                <Badge variant="outline" className="text-xs">
                  Archivé
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <div className="flex gap-3 items-center">
                <DateEditor label="Début" value={project.startDate} projectId={project.id} onChange={onDatesChange} />
                <span className="text-muted-foreground">•</span>
                <DateEditor label="Fin" value={project.endDate} projectId={project.id} onChange={onDatesChange} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={progressPercentage >= 100 ? "default" : "secondary"}>
              {progressPercentage.toFixed(1)}% atteint
            </Badge>
            {(onArchiveProject || onDeleteProject) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {onArchiveProject && (
                      <DropdownMenuItem 
                        onClick={() => onArchiveProject(project.id)}
                        className="cursor-pointer"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {project.archived ? 'Désarchiver' : 'Archiver'}
                      </DropdownMenuItem>
                    )}
                    {onDeleteProject && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setShowDeleteAlert(true)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Budget prévu</p>
              <BudgetEditor project={project} onChange={onPlannedBudgetChange} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Épargné</p>
              <p className="text-xl font-semibold text-green-600">{fmt(project.currentSavings)}€</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Dépensé</p>
              <p className="text-xl font-semibold text-red-600">{fmt(project.currentSpent)}€</p>
            </div>
          </div>
        </div>
      </CardContent>

      {/* AlertDialog pour la suppression - en dehors du DropdownMenu */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le projet</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le projet "{project.name}" ? 
              Cette action est irréversible et supprimera définitivement toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (onDeleteProject) {
                  onDeleteProject(project.id);
                }
                setShowDeleteAlert(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function NameEditor({ project, onChange }: { project: Project, onChange?: (projectId: string, name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name || "");
  const inputRef = useRef(null as HTMLInputElement | null);

  useEffect(() => {
    setValue(project.name || "");
  }, [project.name]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedValue })
      });
      
      if (!res.ok) throw new Error('failed');
      
      setEditing(false);
      if (onChange) onChange(project.id, trimmedValue);
    } catch (e) {
      console.error('could not save project name', e);
    }
  };

  const cancel = () => {
    setValue(project.name || "");
    setEditing(false);
  };

  const onKey = (e: any) => {
    if (e.key === 'Enter') { save(); }
    if (e.key === 'Escape') { cancel(); }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {onChange && (
          <button 
            className="text-muted-foreground hover:text-foreground transition-colors" 
            title="Modifier le nom du projet" 
            onClick={() => setEditing(true)}
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input 
        ref={inputRef} 
        className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none focus:border-primary" 
        value={value} 
        onChange={e => setValue(e.target.value)} 
        onKeyDown={onKey}
        placeholder="Nom du projet"
      />
      <button title="Enregistrer" onClick={save} className="text-green-600 hover:text-green-700">
        <Check className="h-4 w-4" />
      </button>
      <button title="Annuler" onClick={cancel} className="text-red-600 hover:text-red-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function BudgetEditor({ project, onChange }: { project: Project, onChange?: (projectId: string, plannedBudget: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(project.plannedBudget ?? 0));
  const inputRef = useRef(null as HTMLInputElement | null);

  useEffect(() => {
    setValue(String(project.plannedBudget ?? 0));
  }, [project.plannedBudget]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const save = async () => {
    const num = Number(value);
    if (isNaN(num)) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plannedBudget: num })
      });
      if (!res.ok) throw new Error('failed');
      setEditing(false);
      if (onChange) onChange(project.id, num);
    } catch (e) {
      console.error('could not save plannedBudget', e);
    }
  };

  const onKey = (e: any) => {
    if (e.key === 'Enter') { save(); }
    if (e.key === 'Escape') { setEditing(false); setValue(String(project.plannedBudget ?? 0)); }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-xl font-semibold">{new Intl.NumberFormat('fr-FR').format(Number(project.plannedBudget ?? 0))}€</p>
        <button className="text-muted-foreground" title="Modifier le budget" onClick={() => setEditing(true)}>
          <Edit className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} className="border px-2 py-1 rounded w-32" value={value} onChange={e => setValue(e.target.value)} onKeyDown={onKey} />
      <button title="Enregistrer" onClick={save} className="text-green-600"><Check className="h-4 w-4" /></button>
      <button title="Annuler" onClick={() => { setEditing(false); setValue(String(project.plannedBudget ?? 0)); }} className="text-red-600"><X className="h-4 w-4" /></button>
    </div>
  );
}

function DateEditor({ label, value, projectId, onChange }: { label: string; value?: string | null; projectId: string; onChange?: (projectId: string, dates: { startDate?: string | null; endDate?: string | null }) => void; }) {
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState(value || "");

  useEffect(() => setDateValue(value || ""), [value]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null as string | null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: any = {};
    if (label === "Début") payload.startDate = dateValue || null;
    else payload.endDate = dateValue || null;

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'failed to save');
      }
      const updated = await res.json();
      // update local displayed value from response if present so UI updates immediately
      if (updated && updated.project) {
        if (label === 'Début' && updated.project.startDate != null) setDateValue(String(updated.project.startDate));
        if (label === 'Fin' && updated.project.endDate != null) setDateValue(String(updated.project.endDate));
      }
      setEditing(false);
      onChange?.(projectId, { startDate: updated.project ? updated.project.startDate : undefined, endDate: updated.project ? updated.project.endDate : undefined });
    } catch (e: any) {
      console.error('could not save date', e);
      setError(typeof e?.message === 'string' ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setDateValue(value || ''); setEditing(false); };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground mr-1">{label}:</span>
      {editing ? (
        <>
          <div className="flex items-center gap-1">
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={dateValue}
              onChange={e => setDateValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
              }}
            />
            <button type="button" disabled={saving} className="text-green-600" onClick={save} title="Enregistrer">
              {saving ? <span className="text-xs">…</span> : <Save className="h-4 w-4" />}
            </button>
            <button type="button" disabled={saving} className="text-muted-foreground" onClick={cancel} title="Annuler"><X className="h-4 w-4" /></button>
          </div>
          {error ? <div className="text-sm text-red-600 mt-1">{error}</div> : null}
        </>
      ) : (
        <button className="text-sm text-primary underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
          {(dateValue || value) ? new Date(dateValue || value || '').toLocaleDateString('fr-FR') : 'N/A'}
        </button>
      )}
    </div>
  );
}