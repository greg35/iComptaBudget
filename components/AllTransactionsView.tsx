import { useState, useEffect } from "react";
import { Transaction, SavingsAccount } from "../types/budget";
import { apiFetch } from "../utils/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Search, Loader2, RotateCw } from "lucide-react";

export function AllTransactionsView() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch accounts
    useEffect(() => {
        apiFetch('/api/accounts') // Fetch all accounts
            .then((res: Response) => res.json())
            .then((data: any[]) => {
                const normalized = (data || []).map((a: any) => ({
                    id: String(a.id ?? a.ID ?? a.name ?? ''),
                    name: a.name || a.Name || String(a.id || ''),
                    balance: Number(a.balance ?? a.Balance ?? 0) || 0,
                    type: (a.type || 'autre') as any,
                }));
                setAccounts(normalized);
            })
            .catch((err: any) => console.error("Failed to fetch accounts", err));
    }, []);

    // Fetch transactions
    useEffect(() => {
        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedAccount && selectedAccount !== "all") {
                    params.append("account", selectedAccount);
                }
                if (debouncedSearchTerm) {
                    params.append("q", debouncedSearchTerm);
                }
                params.append("limit", "1000");

                const res = await apiFetch(`/api/transactions/search?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    // Enforce sorting by date descending (newest first)
                    data.sort((a: any, b: any) => {
                        const dateA = new Date(a.date || '1970-01-01').getTime();
                        const dateB = new Date(b.date || '1970-01-01').getTime();
                        return dateB - dateA;
                    });
                    setTransactions(data);
                }
            } catch (error) {
                console.error("Failed to fetch transactions", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [selectedAccount, debouncedSearchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
                    <p className="text-muted-foreground">
                        Liste de toutes les transactions ({transactions.length} affichées)
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                    // Force re-fetch
                    const params = new URLSearchParams();
                    if (selectedAccount && selectedAccount !== "all") params.append("account", selectedAccount);
                    if (debouncedSearchTerm) params.append("q", debouncedSearchTerm);
                    params.append("limit", "1000");

                    setLoading(true);
                    apiFetch(`/api/transactions/search?${params.toString()}`)
                        .then((res: Response) => res.json())
                        .then((data: any[]) => {
                            data.sort((a: any, b: any) => {
                                const dateA = new Date(a.date || '1970-01-01').getTime();
                                const dateB = new Date(b.date || '1970-01-01').getTime();
                                return dateB - dateA;
                            });
                            setTransactions(data);
                        })
                        .finally(() => setLoading(false));
                }}>
                    <RotateCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Historique</CardTitle>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <div className="w-full md:w-64">
                                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tous les comptes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les comptes</SelectItem>
                                        {accounts.map(account => (
                                            <SelectItem key={account.id} value={account.id}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Catégorie</TableHead>
                                        <TableHead>Commentaire</TableHead>
                                        <TableHead>Compte</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                Aucune transaction trouvée.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((transaction) => {
                                            const account = accounts.find(a => a.id === (transaction as any).accountId);
                                            const hasMultipleSplits = transaction.splits && transaction.splits.length > 1;

                                            if (hasMultipleSplits) {
                                                return (
                                                    <>
                                                        {/* Parent Row */}
                                                        <TableRow key={transaction.id} className="bg-muted/30 font-medium">
                                                            <TableCell>
                                                                {transaction.date ? new Date(transaction.date).toLocaleDateString('fr-FR') : 'N/A'}
                                                            </TableCell>
                                                            <TableCell>{transaction.description}</TableCell>
                                                            <TableCell className="text-muted-foreground italic">Multi-catégories</TableCell>
                                                            <TableCell></TableCell>
                                                            <TableCell>{account ? account.name : '-'}</TableCell>
                                                            <TableCell className={`text-right ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                                {transaction.type === 'income' ? '+' : ''}
                                                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
                                                            </TableCell>
                                                        </TableRow>
                                                        {/* Split Rows */}
                                                        {transaction.splits?.map((split) => (
                                                            <TableRow key={split.id} className="border-b-0">
                                                                <TableCell></TableCell>
                                                                <TableCell className="pl-8 text-sm text-muted-foreground">↳ Sous-opération</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline">{split.category || 'Sans catégorie'}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {split.comment}
                                                                </TableCell>
                                                                <TableCell></TableCell>
                                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(split.amount)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </>
                                                );
                                            } else {
                                                // Single split or legacy format
                                                const split = transaction.splits ? transaction.splits[0] : null;
                                                const category = split ? split.category : transaction.category;
                                                const comment = split ? split.comment : transaction.comment;

                                                return (
                                                    <TableRow key={transaction.id}>
                                                        <TableCell className="font-medium">
                                                            {transaction.date ? new Date(transaction.date).toLocaleDateString('fr-FR') : 'N/A'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{transaction.description}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{category || 'Sans catégorie'}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={comment}>
                                                            {comment}
                                                        </TableCell>
                                                        <TableCell>
                                                            {account ? account.name : '-'}
                                                        </TableCell>
                                                        <TableCell className={`text-right ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {transaction.type === 'income' ? '+' : ''}
                                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
