import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CalendarIcon, TrendingUpIcon, PiggyBankIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import { apiFetch } from '../utils/apiClient';

interface SavingsEvolutionData {
  month: string;
  totalSavings: number;
  projectSavings: number;
  freeSavings: number;
  savingsAccounts: number;
  monthlySavings: number;
}

interface SavingsEvolutionViewProps {
  projects: any[];
  savingsAccounts: any[];
}

export const SavingsEvolutionView: React.FC<SavingsEvolutionViewProps> = ({ 
  projects: _projects, 
  savingsAccounts: _savingsAccounts 
}) => {
  const [evolutionData, setEvolutionData] = useState<SavingsEvolutionData[]>([]);
  const [historyData, setHistoryData] = useState<SavingsEvolutionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Paramètres de période
  const [periodMonths, setPeriodMonths] = useState(12);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customPeriod, setCustomPeriod] = useState(false);

  // Initialiser les dates par défaut (12 derniers mois)
  useEffect(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // 12 mois en arrière
    const start12MonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    
    setStartDate(start12MonthsAgo.toISOString().substring(0, 7)); // YYYY-MM
    setEndDate(endOfCurrentMonth.toISOString().substring(0, 7));
  }, []);

  const fetchEvolutionData = async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      // Déterminer la période
      let months = periodMonths;
      let targetStartDate = startDate;
      let targetEndDate = endDate;

      if (!customPeriod) {
        // Utiliser la période prédéfinie
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        targetStartDate = start.toISOString().substring(0, 7);
        targetEndDate = end.toISOString().substring(0, 7);
      }

      if (!targetStartDate || !targetEndDate) {
        setEvolutionData([]);
        return;
      }

      if (targetStartDate > targetEndDate) {
        const temp = targetStartDate;
        targetStartDate = targetEndDate;
        targetEndDate = temp;
      }
      let dataset = historyData;
      const lastKnownMonth = historyData.length > 0 ? historyData[historyData.length - 1].month : '';
      if (force || historyData.length === 0 || !lastKnownMonth || lastKnownMonth < targetEndDate) {
        const params = new URLSearchParams();
        params.set('all', 'true');
        params.set('endMonth', targetEndDate);

        const historyResponse = await apiFetch(`/api/monthly-savings?${params.toString()}`);
        if (!historyResponse.ok) {
          throw new Error('Failed to load history');
        }

        const historyRaw = await historyResponse.json();
        const sortedHistory = (historyRaw || []).sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));

        let cumulativeAllocated = 0;
        let cumulativeSpent = 0;

        dataset = sortedHistory.map((item: any) => {
          const monthlySavings = Number(item.totalSavings || 0);
          const projectBreakdown = item.projectBreakdown || {};
          const allocatedThisMonth = Object.values(projectBreakdown).reduce((sum: number, amount: any) => sum + (Number(amount) || 0), 0);
          const totalMonthlyProjectSpent = Number(item.totalMonthlyProjectSpent || 0);
          const savingsAccountsBalance = Number(item.savingsAccountsBalance || 0);

          cumulativeAllocated += allocatedThisMonth;
          cumulativeSpent += totalMonthlyProjectSpent;

          const projectSavingsRaw = Math.max(0, cumulativeAllocated - cumulativeSpent);
          const totalSavings = Math.max(0, savingsAccountsBalance);
          const projectSavings = Math.min(projectSavingsRaw, totalSavings);
          const freeSavings = Math.max(0, totalSavings - projectSavings);

          return {
            month: String(item.month || ''),
            totalSavings,
            projectSavings,
            freeSavings,
            savingsAccounts: totalSavings,
            monthlySavings
          } as SavingsEvolutionData;
        });

        setHistoryData(dataset);
      }

      const filteredResults = dataset.filter(data => data.month >= targetStartDate && data.month <= targetEndDate);
      setEvolutionData(filteredResults);

    } catch (error) {
      console.error('Erreur lors du chargement des données d\'évolution:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchEvolutionData();
    }
  }, [periodMonths, startDate, endDate, customPeriod]);

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  // Calculer les statistiques
  const fallbackTotalSavings = Array.isArray(_savingsAccounts)
    ? _savingsAccounts.reduce((sum: number, account: any) => sum + (Number(account?.balance) || 0), 0)
    : 0;
  const fallbackProjectSavings = Array.isArray(_projects)
    ? _projects.reduce((sum: number, project: any) => sum + (Number(project?.currentSavings) || 0), 0)
    : 0;
  const fallbackFreeSavings = Math.max(0, fallbackTotalSavings - fallbackProjectSavings);

  const currentMonth = evolutionData[evolutionData.length - 1];
  const previousMonth = evolutionData[evolutionData.length - 2];
  const totalEvolution = currentMonth && previousMonth 
    ? currentMonth.totalSavings - previousMonth.totalSavings 
    : 0;

  const displayedTotalSavings = currentMonth ? currentMonth.totalSavings : fallbackTotalSavings;
  const displayedProjectSavings = currentMonth ? currentMonth.projectSavings : fallbackProjectSavings;
  const displayedFreeSavings = currentMonth ? currentMonth.freeSavings : fallbackFreeSavings;

  const averageMonthlySavings = evolutionData.length > 0
    ? evolutionData.reduce((sum, data) => sum + data.monthlySavings, 0) / evolutionData.length
    : 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Évolution épargne</h1>
          <p className="text-muted-foreground">
            Suivez l'évolution de votre épargne dans le temps
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <TrendingUpIcon className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* Contrôles de période */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Période d'analyse
          </CardTitle>
          <CardDescription>
            Sélectionnez la période à analyser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Type de période</Label>
              <Select
                value={customPeriod ? 'custom' : periodMonths.toString()}
                onValueChange={(value: string) => {
                  if (value === 'custom') {
                    setCustomPeriod(true);
                  } else {
                    setCustomPeriod(false);
                    setPeriodMonths(parseInt(value));
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 derniers mois</SelectItem>
                  <SelectItem value="12">12 derniers mois</SelectItem>
                  <SelectItem value="24">24 derniers mois</SelectItem>
                  <SelectItem value="custom">Période personnalisée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {customPeriod && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Du</Label>
                  <Input
                    id="startDate"
                    type="month"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Au</Label>
                  <Input
                    id="endDate"
                    type="month"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}

            <Button onClick={() => fetchEvolutionData(true)} disabled={loading}>
              {loading ? 'Chargement...' : 'Actualiser'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques rapides */}
        <div className="space-y-6">
        <div className="home-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Épargne actuelle</CardTitle>
              <PiggyBankIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(displayedTotalSavings)}</div>
              {totalEvolution !== 0 && (
                <p className={`text-xs ${totalEvolution > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalEvolution > 0 ? '+' : ''}{formatCurrency(totalEvolution)} vs mois précédent
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Épargne projet</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(displayedProjectSavings)}</div>
              <p className="text-xs text-muted-foreground">
                {displayedTotalSavings > 0 ? 
                  `${((displayedProjectSavings / displayedTotalSavings) * 100).toFixed(1)}% du total` : 
                  '0% du total'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Épargne libre</CardTitle>
              <PiggyBankIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(displayedFreeSavings)}</div>
              <p className="text-xs text-muted-foreground">
                {displayedTotalSavings > 0 ? 
                  `${((displayedFreeSavings / displayedTotalSavings) * 100).toFixed(1)}% du total` : 
                  '0% du total'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moyenne mensuelle</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(averageMonthlySavings)}</div>
              <p className="text-xs text-muted-foreground">
                Sur {evolutionData.length} mois
              </p>
            </CardContent>
          </Card>
        </div>
        </div>

      {/* Graphique principal */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution de l'épargne</CardTitle>
          <CardDescription>
            Répartition entre épargne libre (bas) et épargne projet (haut)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Chargement des données...</p>
            </div>
          ) : error ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : evolutionData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Aucune donnée disponible</p>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={evolutionData}
                  margin={{ top: 16, right: 32, bottom: 48, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={formatMonth}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    width={110}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelFormatter={(label) => formatMonth(label)}
                  />
                  <Legend />
                  
                  {/* Épargne libre en bas */}
                  <Area
                    type="monotone"
                    dataKey="freeSavings"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                    name="Épargne libre"
                  />
                  
                  {/* Épargne projet en haut */}
                  <Area
                    type="monotone"
                    dataKey="projectSavings"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Épargne projet"
                  />
                  
                  {/* Ligne du solde des comptes d'épargne */}
                  <Line
                    type="monotone"
                    dataKey="savingsAccounts"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "#f59e0b", r: 4 }}
                    name="Solde comptes épargne"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
