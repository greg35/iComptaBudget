import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TransactionsList } from "./TransactionsList";
import { apiFetch } from "../utils/apiClient";
import { Transaction } from "../types/budget";

export function DayDetailView() {
    const { date } = useParams<{ date: string }>();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    // Parse date from URL or default to today
    const currentDate = date ? parseISO(date) : new Date();

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!date) return;

            setLoading(true);
            try {
                // Fetch all transactions and filter client-side for now
                // Ideally backend should support filtering by exact date or range
                // We'll use the existing endpoint and filter
                const res = await apiFetch('/api/transactions');
                if (res.ok) {
                    const data = await res.json();
                    const dayStart = date; // YYYY-MM-DD

                    const dayTransactions = data.filter((t: any) => {
                        const tDate = t.date || t.txDate;
                        return tDate && tDate.startsWith(dayStart);
                    }).map((t: any) => ({
                        id: String(t.id),
                        date: t.txDate || t.date || '',
                        description: t.description || '',
                        comment: t.comment || '',
                        amount: Number(t.amount || 0),
                        type: t.type || (((t.category || '') === 'Virements d\'épargne' || (t.category || '') === "Virements d'épargne") ? 'income' : 'expense'),
                        category: t.category || ''
                    }));

                    setTransactions(dayTransactions);
                }
            } catch (e) {
                console.error("Failed to fetch transactions", e);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [date]);

    const goToPreviousDay = () => {
        const prev = subDays(currentDate, 1);
        navigate(`/calendar/${format(prev, 'yyyy-MM-dd')}`);
    };

    const goToNextDay = () => {
        const next = addDays(currentDate, 1);
        navigate(`/calendar/${format(next, 'yyyy-MM-dd')}`);
    };

    const goToCalendar = () => {
        navigate('/calendar');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={goToCalendar}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight capitalize">
                    {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </h2>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={goToPreviousDay}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Jour précédent
                </Button>
                <Button variant="outline" onClick={goToNextDay}>
                    Jour suivant
                    <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transactions du jour</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Chargement...</div>
                    ) : transactions.length > 0 ? (
                        <TransactionsList transactions={transactions} />
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Aucune transaction pour ce jour.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
