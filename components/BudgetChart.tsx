import { MonthlyData } from "../types/budget";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface BudgetChartProps {
  data: MonthlyData[];
  projectName: string;
}

export function BudgetChart({ data, projectName }: BudgetChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution du budget - {projectName}</CardTitle>
        <CardDescription>
          Comparaison entre l'argent épargné et l'argent dépensé par mois
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis 
                tickFormatter={(value) => `${value.toLocaleString('fr-FR')}€`}
              />
              <Tooltip 
                formatter={(value: number) => [`${Number(value).toLocaleString('fr-FR')}€`]}
                labelFormatter={(label: string) => `Mois: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="savings" 
                stroke="#16a34a" 
                strokeWidth={2}
                name="Épargné"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="totalMonthlyProjectSpent" 
                stroke="#dc2626" 
                strokeWidth={2}
                name="Dépensé"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {(!data || data.length === 0) ? (
          <div className="mt-4 text-sm text-muted-foreground">Aucune donnée à afficher pour le graphique (vérifiez qu'il existe des transactions avec des dates).</div>
        ) : null}
      </CardContent>
    </Card>
  );
}