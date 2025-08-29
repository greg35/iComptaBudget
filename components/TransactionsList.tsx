// TransactionsList component: renders transaction table for a project
import { Transaction } from "../types/budget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TransactionsListProps {
  transactions: Transaction[];
}

export function TransactionsList({ transactions }: TransactionsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          Historique de toutes les transactions liées à ce projet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          {/* Force column widths so changes are effective across browsers */}
          <colgroup>
            <col style={{ width: '4rem' }} />
            <col style={{ width: '30rem' }} />
            <col style={{ width: '12rem' }} />
            <col style={{ width: '10rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '8rem' }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Date</TableHead>
              <TableHead className="w-[40rem]">Description</TableHead>
              <TableHead className="w-48">Commentaire</TableHead>
              <TableHead className="w-40">Catégorie</TableHead>
              <TableHead className="w-28">Type</TableHead>
              <TableHead className="w-32 text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const clean = (s: string | undefined | null) => (s || '').toString().replace(/\s+/g, ' ').trim();
              const desc = clean(transaction.description);
              const comm = clean(transaction.comment);
              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {transaction.date ? new Date(transaction.date).toLocaleDateString('fr-FR') : 'N/A'}
                  </TableCell>
                  <TableCell className="w-[28rem] max-w-[28rem] px-2" title={transaction.description || ''}>
                    <div className="truncate whitespace-nowrap overflow-hidden" title={transaction.description || ''}>{desc}</div>
                  </TableCell>
                  <TableCell className="w-48 max-w-48 px-2 text-sm text-muted-foreground">
                    <div className="truncate whitespace-nowrap overflow-hidden" title={transaction.comment || ''}>{comm}</div>
                  </TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>
                    <Badge
                      variant={transaction.type === 'income' ? 'default' : 'secondary'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {(transaction.category === "Virements d'épargne") ? 'Épargne' : 'Dépense'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                      {transaction.type === 'income' ? '+' : '-'}{Number.isFinite(Number(transaction.amount)) ? Math.abs(Number(transaction.amount)).toLocaleString('fr-FR') : '0'}€
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}