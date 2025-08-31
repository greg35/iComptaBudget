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