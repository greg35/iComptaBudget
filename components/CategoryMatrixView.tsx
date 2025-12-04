import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from './ui/button';
import { ChevronRight, ChevronDown, Minimize2, Maximize2, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  children?: Category[];
  level?: number;
}

interface TransactionData {
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  month: string;
  total: number;
}

interface CategoryMatrixData {
  months: string[];
  data: TransactionData[];
}

interface CategoryRow {
  category: Category;
  monthlyTotals: { [month: string]: number };
  hasChildren: boolean;
  isExpanded: boolean;
  level: number;
}

export const CategoryMatrixView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [matrixData, setMatrixData] = useState<CategoryMatrixData>({ months: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandLevel, setExpandLevel] = useState<number>(1); // 0 = tout plié, 1 = niveau 1, etc.

  // Sélection de période
  const [periodType, setPeriodType] = useState<'6months' | '12months' | '24months' | 'custom'>('12months');
  const [customStartMonth, setCustomStartMonth] = useState('');
  const [customEndMonth, setCustomEndMonth] = useState('');

  // Calculer la plage de mois en fonction de la période sélectionnée
  const getMonthRange = () => {
    const today = new Date();
    let startDate: Date;
    let endDate = new Date(today.getFullYear(), today.getMonth(), 1);

    if (periodType === 'custom' && customStartMonth && customEndMonth) {
      return { startMonth: customStartMonth, endMonth: customEndMonth };
    }

    switch (periodType) {
      case '6months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        break;
      case '12months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        break;
      case '24months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 23, 1);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    }

    const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

    return { startMonth, endMonth };
  };

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { startMonth, endMonth } = getMonthRange();

        console.log('CategoryMatrixView - Loading data for period:', startMonth, 'to', endMonth);

        // Charger les catégories
        console.log('CategoryMatrixView - Fetching categories...');
        const categoriesResponse = await apiFetch('/api/category-matrix/categories');
        if (!categoriesResponse.ok) {
          throw new Error(`Échec du chargement des catégories (${categoriesResponse.status})`);
        }
        const categoriesList: Category[] = await categoriesResponse.json();
        console.log('CategoryMatrixView - Categories response length:', categoriesList.length);

        // Construire l'arbre hiérarchique
        const categoryMap = new Map<string, Category>();
        categoriesList.forEach(cat => {
          categoryMap.set(cat.id, { ...cat, children: [], level: 0 });
        });

        const rootCategories: Category[] = [];
        categoriesList.forEach(cat => {
          const category = categoryMap.get(cat.id)!;
          if (cat.parentId && categoryMap.has(cat.parentId)) {
            const parent = categoryMap.get(cat.parentId)!;
            if (!parent.children) parent.children = [];
            parent.children.push(category);
            category.level = (parent.level || 0) + 1;
          } else {
            rootCategories.push(category);
          }
        });

        console.log('CategoryMatrixView - Root categories:', rootCategories.length);
        setCategories(rootCategories);

        // Charger les données de transactions
        console.log('CategoryMatrixView - Fetching transaction data...');
        const dataResponse = await apiFetch(`/api/category-matrix/data?startMonth=${startMonth}&endMonth=${endMonth}`);
        if (!dataResponse.ok) {
          throw new Error(`Échec du chargement des données (${dataResponse.status})`);
        }
        const dataJson: CategoryMatrixData = await dataResponse.json();
        console.log('CategoryMatrixView - Data months:', dataJson.months.length, 'rows:', dataJson.data.length);
        setMatrixData(dataJson);

        // Expand categories at level 0 by default
        const initialExpanded = new Set<string>();
        rootCategories.forEach(cat => {
          if (cat.children && cat.children.length > 0) {
            initialExpanded.add(cat.id);
          }
        });
        setExpandedCategories(initialExpanded);

      } catch (error) {
        console.error('CategoryMatrixView - Error loading data:', error);
        console.error('Error details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [periodType, customStartMonth, customEndMonth]);

  // Construire les lignes à afficher (flatten l'arbre selon l'état d'expansion)
  const visibleRows: CategoryRow[] = useMemo(() => {
    const rows: CategoryRow[] = [];
    const dataMap = new Map<string, Map<string, number>>();

    // Indexer les données par catégorie et mois
    matrixData.data.forEach(item => {
      if (!dataMap.has(item.categoryId)) {
        dataMap.set(item.categoryId, new Map());
      }
      dataMap.get(item.categoryId)!.set(item.month, item.total);
    });

    const traverse = (category: Category, level: number) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.id);

      // Calculer les totaux mensuels pour cette catégorie
      const monthlyTotals: { [month: string]: number } = {};
      matrixData.months.forEach(month => {
        monthlyTotals[month] = 0;
      });

      // Si la catégorie a des sous-catégories, faire la somme
      if (hasChildren) {
        const sumChildrenTotals = (cat: Category) => {
          const catData = dataMap.get(cat.id);
          if (catData) {
            catData.forEach((total, month) => {
              monthlyTotals[month] = (monthlyTotals[month] || 0) + total;
            });
          }
          if (cat.children) {
            cat.children.forEach(child => sumChildrenTotals(child));
          }
        };
        sumChildrenTotals(category);
      } else {
        // Sinon, utiliser les données directes
        const catData = dataMap.get(category.id);
        if (catData) {
          catData.forEach((total, month) => {
            monthlyTotals[month] = total;
          });
        }
      }

      rows.push({
        category,
        monthlyTotals,
        hasChildren,
        isExpanded,
        level
      });

      if (hasChildren && isExpanded && category.children) {
        category.children.forEach(child => traverse(child, level + 1));
      }
    };

    categories.forEach(cat => traverse(cat, 0));
    return rows;
  }, [categories, matrixData, expandedCategories]);

  // Calculer les totaux par mois (toutes catégories)
  const monthlyTotals = useMemo(() => {
    const totals: { [month: string]: number } = {};
    matrixData.months.forEach(month => {
      totals[month] = 0;
    });
    matrixData.data.forEach(item => {
      totals[item.month] = (totals[item.month] || 0) + item.total;
    });
    return totals;
  }, [matrixData]);

  // Toggle une catégorie
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Plier/déplier par niveau
  const expandToLevel = (level: number) => {
    setExpandLevel(level);
    const newExpanded = new Set<string>();

    const traverse = (category: Category, currentLevel: number) => {
      if (category.children && category.children.length > 0) {
        if (currentLevel < level) {
          newExpanded.add(category.id);
        }
        category.children.forEach(child => traverse(child, currentLevel + 1));
      }
    };

    categories.forEach(cat => traverse(cat, 0));
    setExpandedCategories(newExpanded);
  };

  // Tout plier
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Tout déplier
  const expandAll = () => {
    const allExpanded = new Set<string>();

    const traverse = (category: Category) => {
      if (category.children && category.children.length > 0) {
        allExpanded.add(category.id);
        category.children.forEach(child => traverse(child));
      }
    };

    categories.forEach(cat => traverse(cat));
    setExpandedCategories(allExpanded);
  };

  // Formater le montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Formater le mois pour l'affichage
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Afficher un message si aucune donnée
  if (categories.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground mb-2">Aucune catégorie trouvée</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez que la base de données iCompta est correctement configurée<br />
                et que des transactions existent dans les comptes marqués "Inclure dans les dépenses"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dépenses par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Contrôles de période */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Période:</label>
              <Select value={periodType} onValueChange={(value: any) => setPeriodType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6months">6 mois</SelectItem>
                  <SelectItem value="12months">12 mois</SelectItem>
                  <SelectItem value="24months">24 mois</SelectItem>
                  <SelectItem value="custom">Personnalisée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Début:</label>
                  <input
                    type="month"
                    value={customStartMonth}
                    onChange={(e) => setCustomStartMonth(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Fin:</label>
                  <input
                    type="month"
                    value={customEndMonth}
                    onChange={(e) => setCustomEndMonth(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          {/* Contrôles d'expansion */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <Minimize2 className="h-4 w-4 mr-1" />
              Tout plier
            </Button>
            <Button variant="outline" size="sm" onClick={() => expandToLevel(1)}>
              Niveau 1
            </Button>
            <Button variant="outline" size="sm" onClick={() => expandToLevel(2)}>
              Niveau 2
            </Button>
            <Button variant="outline" size="sm" onClick={() => expandToLevel(3)}>
              Niveau 3
            </Button>
            <Button variant="outline" size="sm" onClick={expandAll}>
              <Maximize2 className="h-4 w-4 mr-1" />
              Tout déplier
            </Button>
          </div>

          {/* Tableau */}
          <div className="relative">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-30 bg-background shadow-sm">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium sticky left-0 top-0 bg-background z-20 min-w-[250px]">
                      Catégorie
                    </th>
                    {matrixData.months.map(month => (
                      <th key={month} className="text-right p-2 font-medium min-w-[100px] sticky top-0 bg-background z-10">
                        {formatMonth(month)}
                      </th>
                    ))}
                    <th className="text-right p-2 font-medium min-w-[120px] sticky top-0 bg-muted/50 z-10">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => {
                    const rowTotal = Object.values(row.monthlyTotals).reduce((sum, val) => sum + val, 0);
                    const isExpense = rowTotal < 0;

                  return (
                    <tr
                      key={`${row.category.id}-${idx}`}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td
                        className="p-2 sticky left-0 bg-background z-10"
                        style={{ paddingLeft: `${row.level * 1.5 + 0.5}rem` }}
                      >
                        <div className="flex items-center gap-1">
                          {row.hasChildren ? (
                            <button
                              onClick={() => toggleCategory(row.category.id)}
                              className="p-0.5 hover:bg-muted rounded"
                            >
                              {row.isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5" />
                          )}
                          <span className={row.hasChildren ? 'font-medium' : ''}>
                            {row.category.name}
                          </span>
                        </div>
                      </td>
                      {matrixData.months.map(month => {
                        const amount = row.monthlyTotals[month] || 0;
                        return (
                          <td
                            key={month}
                            className={`p-2 text-right tabular-nums ${
                              amount < 0 ? 'text-red-600 dark:text-red-400' :
                              amount > 0 ? 'text-green-600 dark:text-green-400' :
                              'text-muted-foreground'
                            }`}
                          >
                            {amount !== 0 ? formatAmount(amount) : '-'}
                          </td>
                        );
                      })}
                      <td
                        className={`p-2 text-right font-medium tabular-nums bg-muted/50 ${
                          rowTotal < 0 ? 'text-red-600 dark:text-red-400' :
                          rowTotal > 0 ? 'text-green-600 dark:text-green-400' :
                          'text-muted-foreground'
                        }`}
                      >
                        {rowTotal !== 0 ? formatAmount(rowTotal) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {/* Ligne de total */}
                <tr className="border-t-2 font-bold bg-muted/30">
                  <td className="p-2 sticky left-0 bg-muted/30 z-10">
                    Total
                  </td>
                  {matrixData.months.map(month => {
                    const total = monthlyTotals[month] || 0;
                    return (
                      <td
                        key={month}
                        className={`p-2 text-right tabular-nums ${
                          total < 0 ? 'text-red-600 dark:text-red-400' :
                          total > 0 ? 'text-green-600 dark:text-green-400' :
                          'text-muted-foreground'
                        }`}
                      >
                        {total !== 0 ? formatAmount(total) : '-'}
                      </td>
                    );
                  })}
                  <td
                    className={`p-2 text-right tabular-nums ${
                      Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0) < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {formatAmount(Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0))}
                  </td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
