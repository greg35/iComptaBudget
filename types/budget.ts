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
  monthlySavingsTarget?: number; // montant d'épargne cible pour le mois le plus récent
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

export interface TransactionSplit {
  id: string;
  amount: number;
  category: string | null;
  comment: string;
  project?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  type: 'income' | 'expense';
  category?: string | null; // Kept for backward compatibility or simple display
  comment?: string; // Kept for backward compatibility
  accountId?: string;
  isManual?: boolean;
  splits?: TransactionSplit[];
}

export interface MonthlyData {
  month: string; // internal key YYYY-MM
  label?: string; // localized label for display (e.g., 'sept. 2024')
  savings: number;
  totalMonthlyProjectSpent: number;
}

export interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  type: 'livret' | 'compte_courant' | 'pel' | 'autre';
}

export type ViewType = 'home' | 'settings' | 'monthly-savings' | 'month-breakdown' | 'projection-epargne' | 'savings-evolution' | 'category-matrix' | 'projects-table' | 'project' | 'transactions-list';

export interface MonthlyManualSavings {
  month: string; // YYYY-MM
  amount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectAllocation {
  id: string;
  month: string; // YYYY-MM
  projectId: string;
  projectName?: string;
  allocatedAmount: number;
  createdAt?: string;
  updatedAt?: string;
}