export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  plannedBudget: number;
  currentSavings: number;
  currentSpent: number;
  dbProject?: string | null;
  archived?: boolean;
  savingGoals?: ProjectSavingGoal[]; // optionnel: historique des objectifs
}

// Objectif mensuel historisé pour un projet
export interface ProjectSavingGoal {
  id: string;            // identifiant interne
  projectId: string;     // FK projet
  amount: number;        // montant cible mensuel
  startDate: string;     // YYYY-MM-01 début de période (incluse)
  endDate?: string;      // YYYY-MM-31 fin de période (incluse) ou undefined si actif
  createdAt?: string;    // horodatage création
  reason?: string;       // justification (initial, ajustement, etc.)
}

// Réponse de suggestion d'ajustement d'objectif
export interface SavingGoalSuggestion {
  projectId: string;
  currentGoal: number | null;
  suggestedGoal: number;
  remainingBudget: number;
  remainingMonths: number;
  totalMonths: number;
  savedToDate: number;
  expectedSavedBaseline: number; // montant attendu cumulé si linéaire
  performanceGap: number;        // savedToDate - expectedSavedBaseline
  status: 'ahead' | 'behind' | 'on_track' | 'completed';
}

// Performance mensuelle d'un projet par rapport à l'objectif actif
export interface ProjectMonthlyGoalPerformance {
  projectId: string;
  month: string;          // YYYY-MM
  goal: number | null;    // objectif applicable (ou null si aucun)
  actualSavings: number;  // épargne réelle positive sur le mois
  delta: number | null;   // actual - goal (null si pas d'objectif)
  status: 'over' | 'under' | 'on_track' | 'no_goal';
}

export interface Transaction {
  id: string;
  projectId: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  comment?: string;
}

export interface MonthlyData {
  month: string; // internal key YYYY-MM
  label?: string; // localized label for display (e.g., 'sept. 2024')
  savings: number;
  spent: number;
}

export interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  type: 'livret' | 'compte_courant' | 'pel' | 'autre';
}

export type ViewType = 'home' | 'project' | 'settings' | 'monthly-savings' | 'month-breakdown';