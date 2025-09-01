import React from 'react';
import { ProjectSavingGoal } from '../types/budget';

interface SavingGoalsSparklineProps {
  goals: ProjectSavingGoal[];
  className?: string;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  showDots?: boolean;
}

// Construit un jeu de points (x,y) basé sur les changements d'objectif.
// Chaque objectif est représenté à sa date de début. Si un objectif se termine, le changement suivant démarre.
export const SavingGoalsSparkline: React.FC<SavingGoalsSparklineProps> = ({
  goals,
  className,
  height = 40,
  stroke = '#2563eb',
  strokeWidth = 2,
  showDots = true
}) => {
  if (!goals || goals.length === 0) {
    return <div className={className + ' text-xs text-muted-foreground'}>Pas de données</div>;
  }

  // Trier par date de début ascendante
  const sorted = [...goals].sort((a,b) => (a.startDate||'').localeCompare(b.startDate||''));

  // Extraire points de rupture
  const points = sorted.map(g => ({
    ts: monthIndex(g.startDate),
    amount: g.amount
  }));

  // Si dernier objectif actif, on ajoute un point "présent" pour étirer la ligne jusqu'au mois courant
  const last = sorted[sorted.length - 1];
  if (last && !last.endDate) {
    points.push({ ts: monthIndex(new Date().toISOString().slice(0,7) + '-01'), amount: last.amount });
  }

  // Normalisation des X/Y
  const minTs = Math.min(...points.map(p => p.ts));
  const maxTs = Math.max(...points.map(p => p.ts));
  const minVal = Math.min(...points.map(p => p.amount));
  const maxVal = Math.max(...points.map(p => p.amount));
  const spanTs = Math.max(1, maxTs - minTs);
  const spanVal = Math.max(1, maxVal - minVal);

  const w = 160; // largeur fixe compacte

  const pathD = points.map((p,i) => {
    const x = ((p.ts - minTs) / spanTs) * (w - 4) + 2; // padding horizontal
    const y = height - (((p.amount - minVal) / spanVal) * (height - 4) + 2); // inverse Y
    return `${i===0 ? 'M':'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className={className} aria-label="Évolution des objectifs d'épargne">
      <svg width={w} height={height} role="img">
        <path d={pathD} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        {showDots && points.map((p,i) => {
          const x = ((p.ts - minTs) / spanTs) * (w - 4) + 2;
          const y = height - (((p.amount - minVal) / spanVal) * (height - 4) + 2);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatMonth(sorted[0].startDate)}</span>
        <span>{formatMonth(last?.endDate || new Date().toISOString().slice(0,7)+'-01')}</span>
      </div>
    </div>
  );
};

function monthIndex(dateStr?: string) {
  if (!dateStr) return 0;
  const y = Number(dateStr.slice(0,4));
  const m = Number(dateStr.slice(5,7));
  if (isNaN(y)||isNaN(m)) return 0;
  return y*12 + (m-1);
}

function formatMonth(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0,7);
    return d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' });
  } catch {
    return dateStr.slice(0,7);
  }
}

export default SavingGoalsSparkline;
