import React from 'react';
import { Project, SavingsAccount } from '../types/budget';
import { Wallet, PiggyBank, Euro } from 'lucide-react';

interface GlobalSavingsFooterProps {
  projects: Project[];
  savingsAccounts: SavingsAccount[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

export const GlobalSavingsFooter: React.FC<GlobalSavingsFooterProps> = ({ projects, savingsAccounts }) => {
  const activeProjects = projects.filter(p => !p.archived);
  const totalAccountBalance = savingsAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalProjectSavings = activeProjects.reduce((sum, p) => sum + Math.max(0, (p.currentSavings || 0) - (p.currentSpent || 0)), 0);
  const freeBalanceRaw = totalAccountBalance - totalProjectSavings;
  const freeBalance = freeBalanceRaw < 0 ? 0 : freeBalanceRaw;

  return (
    <footer
      className="fixed bottom-0 bg-sidebar text-sidebar-foreground border-t border-sidebar-border z-50 shadow-md"
      style={{
        left: 'var(--sidebar-width)',
        width: 'calc(100% - var(--sidebar-width))'
      }}
    >
      <div className="w-full px-6 py-3 grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-background/10"><Wallet className="h-5 w-5" /></div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide opacity-70">Épargne Totale</span>
            <span className="text-sm font-semibold">{formatCurrency(totalAccountBalance)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-background/10"><PiggyBank className="h-5 w-5" /></div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide opacity-70">Épargne Projets</span>
            <span className="text-sm font-semibold">{formatCurrency(totalProjectSavings)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-background/10"><Euro className="h-5 w-5" /></div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide opacity-70">Épargne Libre</span>
            <span className="text-sm font-semibold">{formatCurrency(freeBalance)}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default GlobalSavingsFooter;
