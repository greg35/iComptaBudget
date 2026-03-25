import { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiClient";
import { ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { Button } from "./ui/button";

export function BankFeesView() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/transactions/bank-fees?year=${year}`);
        if (!res.ok) throw new Error("Failed to fetch bank fees");
        const json = await res.json();
        if (mounted) setData(json || []);
      } catch (err) {
        console.error("Error loading bank fees:", err);
        if (mounted) setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, [year]);

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const feesByMonth = new Array(12).fill(0);
  const cashbackByMonth = new Array(12).fill(0);
  const cashbackTransactionsByMonth: Record<number, any[]> = {};

  // Process data
  data.forEach(tx => {
    if (!tx.date) return;
    const d = new Date(tx.date);
    const m = d.getMonth() + 1; // 1-12

    if (tx.isBankFee) {
      feesByMonth[m - 1] += Math.abs(tx.amount);
    }
    if (tx.isCashback) {
      const rate = tx.isForeignCurrency ? 0.02 : 0.002;
      const cashbackAmt = -tx.amount * rate; // amount is usually negative for expenses, so -amount * rate
      cashbackByMonth[m - 1] += cashbackAmt;

      if (!cashbackTransactionsByMonth[m]) {
        cashbackTransactionsByMonth[m] = [];
      }
      cashbackTransactionsByMonth[m].push({ ...tx, cashbackAmt, rate });
    }
  });

  const totalFeesYear = feesByMonth.reduce((a, b) => a + b, 0);
  const totalCashbackYear = cashbackByMonth.reduce((a, b) => a + b, 0);
  const netByMonth = months.map((_, i) => cashbackByMonth[i] - feesByMonth[i]);
  const netTotalYear = totalCashbackYear - totalFeesYear;

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Suivi Frais Bancaire</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium max-w-[150px]">Description</th>
                {months.map((m, i) => (
                  <th
                    key={i}
                    onClick={() => setSelectedMonth(i + 1)}
                    className={`p-3 text-center font-medium cursor-pointer transition-colors hover:bg-muted ${selectedMonth === i + 1 ? "bg-primary/20 text-primary" : ""
                      }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="p-3 text-center font-bold bg-primary/10">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3 font-medium bg-muted/20">Frais Bancaires</td>
                {feesByMonth.map((amt, i) => (
                  <td
                    key={i}
                    onClick={() => setSelectedMonth(i + 1)}
                    className={`p-3 text-center cursor-pointer transition-colors ${selectedMonth === i + 1 ? "bg-primary/10" : ""
                      } ${amt > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {amt > 0 ? fmt(amt) : "-"}
                  </td>
                ))}
                <td className="p-3 text-center font-bold text-destructive bg-primary/5">{totalFeesYear > 0 ? fmt(totalFeesYear) : "-"}</td>
              </tr>
              <tr>
                <td className="p-3 font-medium bg-muted/20">Cashback (*1630)</td>
                {cashbackByMonth.map((amt, i) => (
                  <td
                    key={i}
                    onClick={() => setSelectedMonth(i + 1)}
                    className={`p-3 text-center cursor-pointer transition-colors ${selectedMonth === i + 1 ? "bg-primary/10" : ""
                      } ${amt > 0 ? "text-green-600 font-medium" : amt < 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {amt !== 0 ? fmt(amt) : "-"}
                  </td>
                ))}
                <td className="p-3 text-center font-bold text-green-600 bg-primary/5">{totalCashbackYear !== 0 ? fmt(totalCashbackYear) : "-"}</td>
              </tr>
              <tr className="border-t-2">
                <td className="p-3 font-bold bg-muted/30">Bilan Net (Cashback - Frais)</td>
                {netByMonth.map((amt, i) => (
                  <td
                    key={i}
                    onClick={() => setSelectedMonth(i + 1)}
                    className={`p-3 text-center cursor-pointer transition-colors ${selectedMonth === i + 1 ? "bg-primary/20" : ""
                      } ${amt > 0 ? "text-green-600 font-bold" : amt < 0 ? "text-destructive font-bold" : "text-muted-foreground font-bold"}`}
                  >
                    {amt !== 0 ? (amt > 0 ? "+" : "") + fmt(amt) : "-"}
                  </td>
                ))}
                <td className={`p-3 text-center font-black bg-primary/10 ${netTotalYear > 0 ? "text-green-600" : netTotalYear < 0 ? "text-destructive" : ""}`}>
                  {netTotalYear !== 0 ? (netTotalYear > 0 ? "+" : "") + fmt(netTotalYear) : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-4 text-center text-sm text-muted-foreground">Chargement des données...</div>
        )}
      </div>

      {selectedMonth !== null && (
        <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Opérations Cashback - {months[selectedMonth - 1]} {year}
          </h2>

          {!cashbackTransactionsByMonth[selectedMonth] || cashbackTransactionsByMonth[selectedMonth].length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune opération éligible au cashback pour ce mois.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left font-medium">Date</th>
                    <th className="p-3 text-left font-medium">Description</th>
                    <th className="p-3 text-right font-medium">Montant Opération</th>
                    <th className="p-3 text-right font-medium">Cashback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cashbackTransactionsByMonth[selectedMonth]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((tx, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="p-3 text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-3">{tx.description}</td>
                        <td className={`p-3 text-right font-medium ${tx.amount > 0 ? "text-green-600" : ""}`}>
                          {fmt(tx.amount)}
                        </td>
                        <td className={`p-3 text-right font-medium ${tx.cashbackAmt > 0 ? "text-green-600" : "text-destructive"}`}>
                          <div className="flex flex-col items-end">
                            <span>{tx.cashbackAmt > 0 ? "+" : ""}{fmt(tx.cashbackAmt)}</span>
                            <span className="text-xs text-muted-foreground">({tx.rate === 0.02 ? "2%" : "0.2%"})</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-muted/20 font-semibold border-t-2">
                    <td className="p-3" colSpan={3}>Total Cashback</td>
                    <td className="p-3 text-right text-green-600">
                      {fmt(cashbackByMonth[selectedMonth - 1])}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
