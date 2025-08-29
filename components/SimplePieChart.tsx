import React from 'react';

interface PieData {
  name: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieData[];
  size?: number;
}

export function SimplePieChart({ data, size = 120 }: SimplePieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) return null;

  let cumulativePercentage = 0;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  return (
    <div className="flex items-center gap-6">
      {/* Graphique en camembert SVG */}
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill="transparent"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -cumulativePercentage;
            
            cumulativePercentage += percentage;
            
            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - 10}
                fill="transparent"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                pathLength="100"
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
      </div>

      {/* Légende */}
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = ((item.value / total) * 100).toFixed(1);
          return (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div className="space-y-1">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(item.value)} ({percentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
