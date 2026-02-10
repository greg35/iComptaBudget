import { Project, SavingsAccount } from "../types/budget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Wallet, Target, TrendingUp, Calendar, Euro, PiggyBank } from "lucide-react";
import { SimplePieChart } from "./SimplePieChart";

interface HomeViewProps {
  projects: Project[];
  savingsAccounts: SavingsAccount[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function HomeView({ projects, savingsAccounts }: HomeViewProps) {
  // Calculs des statistiques
  const activeProjects = projects.filter(project => !project.archived);

  const totalPlannedBudget = projects.reduce((sum, project) => sum + project.plannedBudget, 0);
  const totalCurrentSavings = activeProjects.reduce((sum, project) => sum + Math.max(0, (project.currentSavings || 0) - (project.currentSpent || 0)), 0);
  const totalCurrentSpent = projects.reduce((sum, project) => sum + project.currentSpent, 0);
  const totalAccountBalance = savingsAccounts.reduce((sum, account) => sum + account.balance, 0);
  const freeBalance = totalAccountBalance - totalCurrentSavings;

  // Données pour le graphique en secteurs des comptes
  const accountsChartData = savingsAccounts.map(account => ({
    name: account.name,
    value: account.balance,
    type: account.type
  }));

  // Données pour le graphique de répartition épargne libre/allouée
  const balanceDistribution = [
    { name: 'Épargne libre', value: Math.max(0, freeBalance), color: '#00C49F' },
    { name: 'Épargne allouée', value: Math.max(0, totalCurrentSavings), color: '#fea500ff' }
  ].filter(item => item.value > 0); // Filtrer les valeurs nulles

  // Données pour le graphique des projets actifs
  const projectsChartData = activeProjects.map(project => ({
    name: project.name.length > 15 ? project.name.slice(0, 15) + '...' : project.name,
    planned: project.plannedBudget,
    saved: project.currentSavings,
    spent: project.currentSpent
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'livret': 'Livret',
      'compte_courant': 'Compte courant',
      'pel': 'PEL',
      'autre': 'Autre'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Tableau de bord</h1>
        <p className="text-muted-foreground mt-2">Vue d'ensemble de vos projets et de votre épargne</p>
      </div>

      {/* Première rangée: 4 blocs (responsive) */}
      <div className="home-cols-4">
        <div>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Projets actifs</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{activeProjects.length}</div>
              <p className="text-xs text-muted-foreground">sur {projects.length} projets au total</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Épargne totale</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{formatCurrency(totalAccountBalance)}</div>
              <p className="text-xs text-muted-foreground">Solde total de vos comptes d'épargne</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Épargne projets</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{formatCurrency(totalCurrentSavings)}</div>
              <p className="text-xs text-muted-foreground">{((totalCurrentSavings / totalAccountBalance) * 100).toFixed(1)}% du total</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Épargne libre</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{formatCurrency(freeBalance)}</div>
              <p className="text-xs text-muted-foreground">{((freeBalance / totalAccountBalance) * 100).toFixed(1)}% du total</p>
            </CardContent>
          </Card>
        </div>
     </div>

      {/* Deuxième rangée: 2 blocs */}
      <div className="home-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Répartition de l'épargne</CardTitle>
              <CardDescription>Distribution entre épargne libre et allouée aux projets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {balanceDistribution.length > 0 ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {/* Graphique CSS personnalisé plus fiable */}
                    <SimplePieChart data={balanceDistribution} size={160} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <PiggyBank className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune donnée d'épargne disponible</p>
                      <p className="text-sm">Vérifiez vos comptes et projets</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Mes comptes d'épargne</CardTitle>
              <CardDescription>Détail de vos différents comptes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {savingsAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span>{account.name}</span>
                        <Badge variant="secondary" className="text-xs">{getAccountTypeLabel(account.type)}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div>{formatCurrency(account.balance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Troisième rangée: Projets actifs (full width) */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Projets actifs</CardTitle>
            <CardDescription>Progression de vos projets en cours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {activeProjects.map((project) => {
                const progressPercentage = (project.currentSavings / project.plannedBudget) * 100;
                const remainingDays = Math.ceil((new Date(project.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={project.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4>{project.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{remainingDays > 0 ? `${remainingDays} jours restants` : 'Terminé'}</span>
                          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{formatCurrency(project.currentSavings)} / {formatCurrency(project.plannedBudget)}</span>
                        </div>
                      </div>
                      <Badge variant={progressPercentage >= 100 ? 'default' : 'secondary'}>{progressPercentage.toFixed(0)}%</Badge>
                    </div>
                    <Progress value={Math.min(progressPercentage, 100)} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique comparatif des projets (si plusieurs) */}
      {projectsChartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparaison des projets</CardTitle>
            <CardDescription>Budget prévu, épargné et dépensé par projet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">       
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="planned" fill="#8884d8" name="Budget prévu" />
                  <Bar dataKey="saved" fill="#82ca9d" name="Épargné" />
                  <Bar dataKey="spent" fill="#ff7c7c" name="Dépensé" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}