import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { cn } from '../../../../components/utils';
import { fuelTypeValues, type FuelType } from '../../../../lib/fuel-types';
import type { FuelProduct } from '../../../../lib/product-types';
import { fuelTypeLabels, productPickerQuickFilters } from './constants';
import { NumberField, TextField } from './controls';
import { formatKm, formatProductAmount, groupProductsByBrand } from './helpers';
import type { AidStationDraft, ProductFormValues, StationProduct } from './types';

export function ProductsEditor(props: {
  aidStations: AidStationDraft[];
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  productForm: ProductFormValues;
  productStationId: string | null;
  onOpenProductPicker: (stationId: string) => void;
  onRemoveProduct: (stationId: string, productId: string) => void;
  onToggleProductForm: (stationId: string) => void;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const savedStations = props.aidStations.filter((station): station is AidStationDraft & { id: string } => Boolean(station.id));
  if (savedStations.length === 0) {
    return <p className="text-sm text-muted-foreground">Sauvegarde au moins un ravito avant d'y associer des produits.</p>;
  }
  return (
    <div className="space-y-4">
      {savedStations.map((station) => (
        <div key={station.id} className="rounded-md border border-border bg-background p-4">
          <p className="font-semibold text-foreground">{station.name}</p>
          <p className="text-sm text-muted-foreground">{formatKm(station.distanceKm)}</p>
          <StationProductsBlock
            station={station}
            stationProducts={props.stationProducts}
            productsById={props.productsById}
            onOpenProductPicker={() => props.onOpenProductPicker(station.id)}
            onRemoveProduct={(productId) => props.onRemoveProduct(station.id, productId)}
            productFormOpen={props.productStationId === station.id}
            onToggleProductForm={() => props.onToggleProductForm(station.id)}
            productForm={props.productForm}
            onProductFormChange={props.onProductFormChange}
            onCreateProduct={props.onCreateProduct}
            disabled={props.status === "saving"}
          />
        </div>
      ))}
    </div>
  );
}

export function StationProductsBlock({
  station,
  stationProducts,
  productsById,
  onOpenProductPicker,
  onRemoveProduct,
  productFormOpen,
  onToggleProductForm,
  productForm,
  onProductFormChange,
  onCreateProduct,
  disabled,
}: {
  station: AidStationDraft & { id?: string };
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  onOpenProductPicker: () => void;
  onRemoveProduct: (productId: string) => void;
  productFormOpen: boolean;
  onToggleProductForm: () => void;
  productForm: ProductFormValues;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
}) {
  const linkedProducts = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Produits proposés</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onOpenProductPicker} disabled={disabled}>
            Ajouter un produit
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={onToggleProductForm}>
            {productFormOpen ? "Fermer" : "Créer un produit"}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex min-h-16 flex-wrap gap-2 rounded-md border border-dashed border-brand-border bg-brand-surface/50 p-2 dark:border-emerald-400/50 dark:bg-emerald-500/5">
        {linkedProducts.length === 0 ? (
          <p className="self-center px-2 text-xs text-muted-foreground">Aucun produit attaché à ce ravito.</p>
        ) : (
          linkedProducts.map((link) => {
            const product = link.product ?? productsById.get(link.productId);
            return (
              <div key={link.productId} className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-border bg-card px-3 py-1 text-xs text-foreground">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{product?.name ?? link.productId}</p>
                  {product ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                  {fuelTypeLabels[product.fuelType]} - {formatProductAmount(product.carbsGrams, "g glucides")} - {formatProductAmount(product.sodiumMg, "mg sodium")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="h-6 w-6 shrink-0 rounded-full border border-red-200 bg-red-50 text-sm font-semibold leading-none text-red-700"
                  onClick={() => onRemoveProduct(link.productId)}
                  aria-label={`Retirer ${product?.name ?? "ce produit"}`}
                >
                  x
                </button>
              </div>
            );
          })
        )}
      </div>
      {productFormOpen ? (
        <form className="mt-3 grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-3" onSubmit={onCreateProduct}>
          <div className="md:col-span-2">
            <TextField label="Nom produit" value={productForm.name} onChange={(value) => onProductFormChange({ ...productForm, name: value })} required />
          </div>
          <TextField label="Marque" value={productForm.brand} onChange={(value) => onProductFormChange({ ...productForm, brand: value })} />
          <div className="space-y-1">
            <Label>Type</Label>
            <select className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" value={productForm.fuelType} onChange={(event) => onProductFormChange({ ...productForm, fuelType: event.target.value as FuelType })}>
              {fuelTypeValues.map((fuelType) => (
                <option key={fuelType} value={fuelType}>
                  {fuelTypeLabels[fuelType]}
                </option>
              ))}
            </select>
          </div>
          <NumberField label="Calories" value={productForm.caloriesKcal} onChange={(value) => onProductFormChange({ ...productForm, caloriesKcal: value })} />
          <NumberField label="Glucides g" value={productForm.carbsGrams} onChange={(value) => onProductFormChange({ ...productForm, carbsGrams: value })} />
          <NumberField label="Sodium mg" value={productForm.sodiumMg} onChange={(value) => onProductFormChange({ ...productForm, sodiumMg: value })} />
          <NumberField label="Protéines g" value={productForm.proteinGrams} onChange={(value) => onProductFormChange({ ...productForm, proteinGrams: value })} />
          <NumberField label="Lipides g" value={productForm.fatGrams} onChange={(value) => onProductFormChange({ ...productForm, fatGrams: value })} />
          <TextField label="SKU" value={productForm.sku} onChange={(value) => onProductFormChange({ ...productForm, sku: value })} />
          <div className="md:col-span-2">
            <TextField label="URL produit" value={productForm.productUrl} onChange={(value) => onProductFormChange({ ...productForm, productUrl: value })} placeholder="https://..." />
          </div>
          <TextField label="Note ravito" value={productForm.notes} onChange={(value) => onProductFormChange({ ...productForm, notes: value })} />
          <div className="md:col-span-3">
            <Button type="submit" disabled={disabled}>
              Créer et attacher à {station.name}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function ProductPickerModal({
  station,
  products,
  linkedProductIds,
  search,
  onSearchChange,
  onAddProduct,
  onClose,
  disabled,
}: {
  station: (AidStationDraft & { id?: string }) | null;
  products: FuelProduct[];
  linkedProductIds: Set<string>;
  search: string;
  onSearchChange: (value: string) => void;
  onAddProduct: (productId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof productPickerQuickFilters)[number]["id"]>("all");
  const stationId = station?.id ?? null;

  useEffect(() => {
    if (!station) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, station]);

  useEffect(() => {
    if (stationId) setActiveFilter("all");
  }, [stationId]);

  if (!station) return null;

  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const selectedFilter = productPickerQuickFilters.find((filter) => filter.id === activeFilter) ?? productPickerQuickFilters[0]!;
  const filteredProducts = products.filter((product) => {
    const matchesType = selectedFilter.fuelTypes ? selectedFilter.fuelTypes.includes(product.fuelType) : true;
    if (!matchesType) return false;
    if (!normalizedSearch) return true;
    return [product.name, product.brand, fuelTypeLabels[product.fuelType], product.sku]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("fr").includes(normalizedSearch));
  });
  const groupedProducts = groupProductsByBrand(filteredProducts);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="organizer-product-picker-title" className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-300">Catalogue</p>
            <h2 id="organizer-product-picker-title" className="mt-1 text-xl font-semibold text-foreground">
              Ajouter un produit à {station.name}
            </h2>
          </div>
          <Button type="button" variant="ghost" className="h-8 px-2" onClick={onClose} aria-label="Fermer">
            x
          </Button>
        </div>
        <div className="border-b border-border p-4">
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher un produit, une marque ou un type" autoFocus />
          <div className="mt-3 flex flex-wrap gap-2">
            {productPickerQuickFilters.map((filter) => {
              const isActive = filter.id === activeFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    isActive ? "border-brand bg-brand text-brand-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:border-brand-border hover:text-foreground"
                  )}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">Aucun produit trouvé.</p>
          ) : (
            <div className="grid gap-5">
              {groupedProducts.map((group) => (
                <section key={group.brand} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">{group.brand}</h3>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">{group.items.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {group.items.map((product) => {
                      const alreadyLinked = linkedProductIds.has(product.id);
                      return (
                        <div key={product.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1.5" /> : <span className="text-[11px] text-muted-foreground">Produit</span>}
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div>
                              <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{fuelTypeLabels[product.fuelType]}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.carbsGrams, "g glucides")}</span>
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.sodiumMg, "mg sodium")}</span>
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.caloriesKcal, "kcal")}</span>
                            </div>
                          </div>
                          <Button type="button" variant={alreadyLinked ? "outline" : "default"} disabled={alreadyLinked || disabled} onClick={() => onAddProduct(product.id)}>
                            {alreadyLinked ? "Déjà ajouté" : "Ajouter"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
