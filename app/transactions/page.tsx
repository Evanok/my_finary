"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { CsvImport } from "@/components/transactions/csv-import";

interface Transaction {
  id: string;
  date: string;
  type: string;
  quantity: number;
  price: number;
  currency: string;
  asset: { symbol: string; name: string; category: string };
  account: { institution: string; type: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    const res = await fetch("/api/transactions");
    const data = await res.json();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  async function deleteTransaction(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTransactions();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual">
            <TabsList className="mb-4">
              <TabsTrigger value="manual">Manual entry</TabsTrigger>
              <TabsTrigger value="csv">CSV import</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
              <TransactionForm onCreated={fetchTransactions} />
            </TabsContent>
            <TabsContent value="csv">
              <CsvImport onImported={fetchTransactions} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {["Date", "Type", "Asset", "Category", "Account", "Qty", "Price", "Total"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={tx.type === "buy" ? "default" : "secondary"}>
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{tx.asset.symbol}</span>
                    <span className="ml-2 text-muted-foreground text-xs">{tx.asset.name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {tx.asset.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tx.account.institution} — {tx.account.type}
                  </td>
                  <td className="px-4 py-3">{tx.quantity}</td>
                  <td className="px-4 py-3">
                    {tx.price.toLocaleString()} {tx.currency}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {(tx.quantity * tx.price).toLocaleString()} {tx.currency}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTransaction(tx.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
