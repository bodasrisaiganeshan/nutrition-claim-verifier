"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ScanSearch,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Check,
} from "lucide-react";
import { runVerify, runOcr, fetchDataset, ProductRecord, VerifyResponse } from "@/lib/api";

const SUPPORTED_CLAIMS = [
  "No Added Sugar",
  "Sugar Free",
  "Low Sugar",
  "High Protein",
  "Source of Protein",
  "High Fibre",
  "Source of Fibre",
  "Low Fat",
  "Fat Free",
];

const CATEGORIES = [
  "Snack Foods",
  "Cereals & Breakfast",
  "Fruit Juices & Drinks",
  "Protein Bars",
  "Biscuits & Cookies",
  "Dairy & Milk Powders",
  "Bread & Bakery",
  "Condiments & Sauces",
  "General Packaged Foods",
];

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillName = searchParams.get("prefill");

  // Basic info
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Snack Foods");
  const [claim, setClaim] = useState("No Added Sugar");
  const [customClaim, setCustomClaim] = useState("");
  const [foodForm, setFoodForm] = useState<"solid" | "liquid">("solid");

  // Image & OCR
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState<string | null>(null);
  const [rawOcrLines, setRawOcrLines] = useState<string[]>([]);

  // Nutrients (per 100g / 100ml)
  const [energy, setEnergy] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [totalFat, setTotalFat] = useState<string>("");
  const [saturatedFat, setSaturatedFat] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [totalSugars, setTotalSugars] = useState<string>("");
  const [addedSugars, setAddedSugars] = useState<string>("");
  const [sodium, setSodium] = useState<string>("");
  const [dietaryFibre, setDietaryFibre] = useState<string>("");

  // Ingredients
  const [ingredients, setIngredients] = useState<string>("");

  // Submission state
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if prefill product exists in dataset
  useEffect(() => {
    if (prefillName) {
      setProductName(prefillName);
      fetchDataset().then(({ products }) => {
        const found = products.find(
          (p) => p.product_name.toLowerCase() === prefillName.toLowerCase()
        );
        if (found) {
          setCategory(found.category || "Snack Foods");
          setClaim(found.front_claim || "No Added Sugar");
          setIngredients(found.ingredients || "");
          setFoodForm(found.form === "liquid" ? "liquid" : "solid");
          if (found.nutrients) {
            setEnergy(found.nutrients.energy_kcal ? String(found.nutrients.energy_kcal) : "");
            setProtein(found.nutrients.protein_g ? String(found.nutrients.protein_g) : "");
            setTotalFat(found.nutrients.total_fat_g ? String(found.nutrients.total_fat_g) : "");
            setSaturatedFat(found.nutrients.saturated_fat_g ? String(found.nutrients.saturated_fat_g) : "");
            setCarbs(found.nutrients.carbohydrates_g ? String(found.nutrients.carbohydrates_g) : "");
            setTotalSugars(found.nutrients.total_sugars_g ? String(found.nutrients.total_sugars_g) : "");
            setAddedSugars(found.nutrients.added_sugars_g !== undefined ? String(found.nutrients.added_sugars_g) : "");
            setSodium(found.nutrients.sodium_mg ? String(found.nutrients.sodium_mg) : "");
            setDietaryFibre(found.nutrients.dietary_fibre_g ? String(found.nutrients.dietary_fibre_g) : "");
          }
        }
      });
    }
  }, [prefillName]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setOcrError(null);
      setOcrSuccess(null);
    }
  };

  const handleRunOcr = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrSuccess(null);

    try {
      const data = await runOcr(imageFile);
      if (data.success) {
        setOcrSuccess(`Label scanned successfully with ${data.engine || "OCR"}. Values populated below.`);
        setRawOcrLines(data.lines || []);
        if (data.ingredients) setIngredients(data.ingredients);
        if (data.form) setFoodForm(data.form === "liquid" ? "liquid" : "solid");

        // Populate nutrients
        if (data.nutrients) {
          if (data.nutrients.energy_kcal !== undefined) setEnergy(String(data.nutrients.energy_kcal));
          if (data.nutrients.protein_g !== undefined) setProtein(String(data.nutrients.protein_g));
          if (data.nutrients.total_fat_g !== undefined) setTotalFat(String(data.nutrients.total_fat_g));
          if (data.nutrients.saturated_fat_g !== undefined) setSaturatedFat(String(data.nutrients.saturated_fat_g));
          if (data.nutrients.carbohydrates_g !== undefined) setCarbs(String(data.nutrients.carbohydrates_g));
          if (data.nutrients.total_sugars_g !== undefined) setTotalSugars(String(data.nutrients.total_sugars_g));
          if (data.nutrients.added_sugars_g !== undefined) setAddedSugars(String(data.nutrients.added_sugars_g));
          if (data.nutrients.sodium_mg !== undefined) setSodium(String(data.nutrients.sodium_mg));
          if (data.nutrients.dietary_fibre_g !== undefined) setDietaryFibre(String(data.nutrients.dietary_fibre_g));
        }
      } else {
        setOcrError(data.message || "Failed to scan image. You can enter values manually.");
      }
    } catch (err: any) {
      setOcrError(err?.message || "OCR service unavailable on remote backend. Please fill in the label values manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    const activeClaim = claim === "custom" ? customClaim : claim;
    if (!activeClaim) {
      setError("Please select or enter a front-of-pack claim.");
      setVerifying(false);
      return;
    }

    // Build nutrients dict
    const nutrients: Record<string, number> = {};
    if (energy) nutrients.energy_kcal = parseFloat(energy);
    if (protein) nutrients.protein_g = parseFloat(protein);
    if (totalFat) nutrients.total_fat_g = parseFloat(totalFat);
    if (saturatedFat) nutrients.saturated_fat_g = parseFloat(saturatedFat);
    if (carbs) nutrients.carbohydrates_g = parseFloat(carbs);
    if (totalSugars) nutrients.total_sugars_g = parseFloat(totalSugars);
    if (addedSugars) nutrients.added_sugars_g = parseFloat(addedSugars);
    if (sodium) nutrients.sodium_mg = parseFloat(sodium);
    if (dietaryFibre) nutrients.dietary_fibre_g = parseFloat(dietaryFibre);

    try {
      const response = await runVerify({
        claim: activeClaim,
        ingredients: ingredients.trim(),
        nutrients,
        form: foodForm,
        basis: "per_100",
        product_name: productName.trim() || "Uploaded Product",
        category,
      });

      // Save to sessionStorage so Results page can render actual response
      sessionStorage.setItem("ncv_active_verification", JSON.stringify(response));
      sessionStorage.setItem(
        "ncv_product_input",
        JSON.stringify({
          product_name: productName.trim() || "Uploaded Product",
          category,
          claim: activeClaim,
          foodForm,
          nutrients,
          ingredients,
        })
      );

      // Navigate to results page
      router.push("/results");
    } catch (err: any) {
      setError(err?.message || "Verification request failed. Please check the backend connection.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Verify Product Nutrition Claim
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a food packaging label or enter declared values to check against FSSAI regulatory thresholds.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Card 1: Product & Claim Details */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">1</span>
            <span>Product & Claim Identification</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="product-name">
                Product Name
              </label>
              <input
                id="product-name"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Lay's Potato Chips, Pintola Butter, etc."
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="product-category">
                FMCG Category
              </label>
              <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="claim-select">
                Front-of-Pack Claim to Audit
              </label>
              <select
                id="claim-select"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {SUPPORTED_CLAIMS.map((c) => (
                  <option key={c} value={c}>
                    {c} (FSSAI Phase-1 Rule)
                  </option>
                ))}
                <option value="custom">Other / Custom Claim...</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Food Physical Form
              </label>
              <div className="grid grid-cols-2 gap-2 h-10">
                <button
                  type="button"
                  onClick={() => setFoodForm("solid")}
                  className={`rounded-lg border text-xs font-semibold transition-all ${
                    foodForm === "solid"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Solid (per 100 g)
                </button>
                <button
                  type="button"
                  onClick={() => setFoodForm("liquid")}
                  className={`rounded-lg border text-xs font-semibold transition-all ${
                    foodForm === "liquid"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Liquid (per 100 ml)
                </button>
              </div>
            </div>
          </div>

          {claim === "custom" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="custom-claim">
                Custom Claim Text
              </label>
              <input
                id="custom-claim"
                type="text"
                value={customClaim}
                onChange={(e) => setCustomClaim(e.target.value)}
                placeholder="e.g. 100% Atta, Diabetic Friendly, Healthy Heart"
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Card 2: Label Photo & OCR Extraction */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">2</span>
              <span>Label Photo & OCR Extraction (Optional)</span>
            </h2>
            <span className="text-xs text-muted-foreground">RapidOCR / PaddleOCR</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload Area */}
            <div className="flex flex-col justify-between p-5 rounded-xl border-2 border-dashed border-border bg-secondary/30 hover:border-primary/50 transition-colors">
              <div className="flex flex-col items-center justify-center text-center py-4">
                <UploadCloud className="size-10 text-muted-foreground mb-2" />
                <p className="text-xs font-semibold text-foreground">Upload back-of-pack label photo</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">JPEG, PNG, WebP up to 10MB</p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="label-photo-upload"
                />
                <label
                  htmlFor="label-photo-upload"
                  className="mt-3 cursor-pointer rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                >
                  Choose File
                </label>
              </div>

              {imageFile && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate max-w-[180px]">
                    {imageFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={ocrLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
                  >
                    {ocrLoading ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" />
                        <span>Run OCR</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Preview & Status */}
            <div className="flex flex-col justify-center items-center rounded-xl border border-border bg-card p-4 min-h-[160px]">
              {imagePreview ? (
                <div className="relative w-full h-44 rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Label preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  No image selected. You can scan an image or fill out the nutrition values directly below.
                </p>
              )}

              {ocrSuccess && (
                <div className="mt-3 w-full p-2.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
                  <Check className="size-4 shrink-0" />
                  <span>{ocrSuccess}</span>
                </div>
              )}

              {ocrError && (
                <div className="mt-3 w-full p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Extracted Nutrition Facts Panel */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">3</span>
              <span>Nutrition Facts per 100 {foodForm === "solid" ? "g" : "ml"} (Editable)</span>
            </h2>
            <span className="text-xs text-muted-foreground">Checked by Rule Engine</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Energy (kcal)</label>
              <input
                type="number"
                step="any"
                value={energy}
                onChange={(e) => setEnergy(e.target.value)}
                placeholder="450"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Protein (g)</label>
              <input
                type="number"
                step="any"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="6.5"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Total Fat (g)</label>
              <input
                type="number"
                step="any"
                value={totalFat}
                onChange={(e) => setTotalFat(e.target.value)}
                placeholder="20.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Saturated Fat (g)</label>
              <input
                type="number"
                step="any"
                value={saturatedFat}
                onChange={(e) => setSaturatedFat(e.target.value)}
                placeholder="5.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Carbohydrates (g)</label>
              <input
                type="number"
                step="any"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="60.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Total Sugars (g)</label>
              <input
                type="number"
                step="any"
                value={totalSugars}
                onChange={(e) => setTotalSugars(e.target.value)}
                placeholder="8.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Added Sugars (g)</label>
              <input
                type="number"
                step="any"
                value={addedSugars}
                onChange={(e) => setAddedSugars(e.target.value)}
                placeholder="0.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Dietary Fibre (g)</label>
              <input
                type="number"
                step="any"
                value={dietaryFibre}
                onChange={(e) => setDietaryFibre(e.target.value)}
                placeholder="3.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sodium (mg)</label>
              <input
                type="number"
                step="any"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                placeholder="450.0"
                className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Card 4: Ingredients List */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">4</span>
              <span>Ingredients List (Critical for Masked Sugars & Whole Grain Audit)</span>
            </h2>
            <span className="text-xs text-muted-foreground">Order of predominance</span>
          </div>

          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={4}
            placeholder="e.g. Potatoes, Edible Vegetable Oil (Palmolein), Seasoning (Sugar, Maltodextrin, Salt, Invert Sugar Syrup, Spices and Condiments)..."
            className="w-full p-3 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed font-mono"
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="size-3.5 text-primary shrink-0" />
            <span>
              The FSSAI rule engine parses this text to detect masked sugar derivatives (invert syrup, maltodextrin), palm oil, and refined wheat flour (maida).
            </span>
          </p>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={verifying}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
          >
            {verifying ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                <span>Evaluating FSSAI Rules...</span>
              </>
            ) : (
              <>
                <ScanSearch className="size-4" />
                <span>Verify Claim Against FSSAI Rules</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
