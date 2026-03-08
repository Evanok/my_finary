"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  onImported: () => void;
}

// Expected CSV columns (order matters, headers required):
// date, symbol, name, category, native_currency, quantity, price, currency, type, account_institution, account_type

export function CsvImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (res) => setPreview(res.data),
    });
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setLoading(true);

    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: preview }),
    });
    const data = await res.json();
    setResult(data);
    if (data.created > 0) {
      setPreview([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          CSV format — required headers:{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            date, symbol, name, category, native_currency, quantity, price, currency, type, account_institution, account_type
          </code>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {preview.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{preview.length} rows detected</Badge>
            <Button onClick={handleImport} disabled={loading}>
              {loading ? "Importing..." : `Import ${preview.length} transactions`}
            </Button>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="text-xs w-full">
              <thead className="bg-muted">
                <tr>
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.length > 5 && (
                  <tr className="border-t">
                    <td
                      colSpan={Object.keys(preview[0]).length}
                      className="px-3 py-2 text-muted-foreground"
                    >
                      ...and {preview.length - 5} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-green-600 dark:text-green-400">
            {result.created} transaction{result.created !== 1 ? "s" : ""} imported
          </p>
          {result.errors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
