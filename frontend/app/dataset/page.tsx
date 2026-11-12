"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Database,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  ScanSearch,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { fetchDataset, ProductRecord } from "@/lib/api";

export default function DatasetPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedVerdict, setSelectedVerdict] = useState("all");

  // Selected product for modal inspection
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);

  useEffect(() => {
    fetchDataset()
      .then(({ products }) => setProducts(products))
      .catch((err) => setError(err?.message || "Failed to load dataset"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (selectedVerdict === "compliant" && !p.is_technically_compliant) return false;
      if (selectedVerdict === "non_compliant" && p.is_technically_compliant) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = p.product_name.toLowerCase().includes(query);
        const matchesClaim = p.front_claim.toLowerCase().includes(query);
        const matchesIngredients = p.ingredients.toLowerCase().includes(query);
        const matchesLoophole = p.deceptive_mechanism.toLowerCase().includes(query);
        if (!matchesName && !matchesClaim && !matchesIngredients && !matchesLoophole) {
          return false;
        }
      }

      return true;
    });
  }, [products, search, selectedCategory, selectedVerdict]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <Database className="size-3.5" />
          <span>Curated Indian FMCG Benchmark Dataset</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Food Label Audit Dataset Explorer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          25 real Indian packaged food products audited for front-of-pack claims, back-of-pack nutrition, and deceptive loopholes.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, claims, ingredients, or loopholes..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Category filter */}
        <div className="w-full md:w-56">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Verdict filter */}
        <div className="w-full md:w-48">
          <select
            value={selectedVerdict}
            onChange={(e) => setSelectedVerdict(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Legal Verdicts</option>
            <option value="compliant">Compliant</option>
            <option value="non_compliant">Non-Compliant</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filteredProducts.length} of {products.length} audited products</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-5 py-3 font-semibold">Product Name</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Claim Tested</th>
                <th className="px-5 py-3 font-semibold">Legal Verdict</th>
                <th className="px-5 py-3 font-semibold">Severity</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-muted-foreground font-semibold">
                    NCV-{String(p.id).padStart(4, "0")}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-foreground max-w-xs truncate">
                    {p.product_name}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.category}</td>
                  <td className="px-5 py-3.5 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-primary font-semibold">
                      {p.front_claim}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium ${
                        p.is_technically_compliant
                          ? "bg-success/10 text-success border border-success/30"
                          : "bg-destructive/10 text-destructive border border-destructive/30"
                      }`}
                    >
                      {p.is_technically_compliant ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                      {p.is_technically_compliant ? "Compliant" : "Non-Compliant"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        p.severity_level?.toLowerCase() === "high"
                          ? "bg-destructive/10 text-destructive"
                          : p.severity_level?.toLowerCase() === "low"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {p.severity_level || "Medium"} Risk
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                        title="Inspect nutrition & ingredients"
                      >
                        <Eye className="size-3.5" />
                        <span>Inspect</span>
                      </button>
                      <Link
                        href={`/verify?prefill=${encodeURIComponent(p.product_name)}`}
                        className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                        title="Audit this product in Rule Engine"
                      >
                        <ScanSearch className="size-3.5" />
                        <span>Verify</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No products found matching your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="font-mono text-xs text-muted-foreground">
                  NCV-{String(selectedProduct.id).padStart(4, "0")} · {selectedProduct.category}
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">
                  {selectedProduct.product_name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-secondary text-primary font-semibold text-xs">
                    Claim: {selectedProduct.front_claim}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedProduct.is_technically_compliant
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {selectedProduct.is_technically_compliant ? "Compliant" : "Non-Compliant"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Deceptive Mechanism */}
            {selectedProduct.deceptive_mechanism && (
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 text-xs text-foreground space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-warning">
                  <ShieldAlert className="size-4" />
                  Deceptive Marketing Loophole / Framing
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {selectedProduct.deceptive_mechanism}
                </p>
              </div>
            )}

            {/* Nutrients */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Declared Nutrients (per 100 {selectedProduct.form === "liquid" ? "ml" : "g"})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(selectedProduct.nutrients || {}).map(([k, v]) => (
                  <div key={k} className="p-2 rounded-lg border border-border bg-secondary/20 flex justify-between">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ingredients List
              </h3>
              <p className="p-3 rounded-lg border border-border bg-secondary/20 text-xs font-mono text-foreground leading-relaxed">
                {selectedProduct.ingredients || "Not listed."}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted"
              >
                Close
              </button>
              <Link
                href={`/verify?prefill=${encodeURIComponent(selectedProduct.product_name)}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                <ScanSearch className="size-3.5" />
                <span>Audit in Rule Engine</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
