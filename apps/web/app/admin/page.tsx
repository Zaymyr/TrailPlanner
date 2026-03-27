"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { TabsList } from "../../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { fuelTypeValues } from "../../lib/fuel-types";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import AdminGrowthSection from "./components/AdminGrowthSection";
import AdminRaceCatalogSection from "./components/AdminRaceCatalogSection";

const adminProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  name: z.string(),
  productUrl: z.string().optional(),
  isLive: z.boolean(),
  isArchived: z.boolean(),
  updatedAt: z.string(),
  fuelType: z.string().optional(),
  caloriesKcal: z.number().nonnegative().optional(),
  carbsGrams: z.number().nonnegative().optional(),
  sodiumMg: z.number().nonnegative().optional(),
  proteinGrams: z.number().nonnegative().optional(),
  fatGrams: z.number().nonnegative().optional(),
});

const editProductFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  sku: z.string().trim().optional(),
  productUrl: z.string().url().or(z.literal("")).optional(),
  fuelType: z.enum(fuelTypeValues),
  caloriesKcal: z.coerce.number().nonnegative(),
  carbsGrams: z.coerce.number().nonnegative(),
  sodiumMg: z.coerce.number().nonnegative(),
  proteinGrams: z.coerce.number().nonnegative(),
  fatGrams: z.coerce.number().nonnegative(),
});

type EditProductFormValues = z.infer<typeof editProductFormSchema>;

const adminUsersSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().email().optional(),
      createdAt: z.string(),
      lastSignInAt: z.string().optional(),
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
      premiumGrant: z
        .object({
          id: z.string(),
          startsAt: z.string(),
          initialDurationDays: z.number(),
          remainingDurationDays: z.number(),
          reason: z.string(),
        })
        .nullable()
        .optional(),
      trial: z
        .object({
          endsAt: z.string(),
          remainingDays: z.number(),
        })
        .nullable()
        .optional(),
      subscription: z
        .object({
          status: z.string(),
          currentPeriodEnd: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
  ),
});

const adminUserSchema = adminUsersSchema.shape.users.element;

const premiumGrantResponseSchema = z.object({
  premiumGrant: z
    .object({
      id: z.string(),
      startsAt: z.string(),
      initialDurationDays: z.number(),
      remainingDurationDays: z.number(),
      reason: z.string(),
    })
    .nullable(),
});

const userRoleOptions = ["user", "coach", "admin"] as const;
type UserRoleOption = (typeof userRoleOptions)[number];

const adminAnalyticsSchema = z.object({
  totals: z.object({
    popupOpens: z.number(),
    clicks: z.number(),
  }),
  productStats: z.array(
    z.object({
      productId: z.string(),
      productName: z.string().optional(),
      popupOpens: z.number(),
      clicks: z.number(),
    })
  ),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      productName: z.string().optional(),
      eventType: z.enum(["popup_open", "click"]),
      countryCode: z.string().optional(),
      merchant: z.string().optional(),
      occurredAt: z.string(),
    })
  ),
});

const basePillClass = "rounded-full px-3 py-1 text-xs font-semibold";

const premiumGrantFormSchema = z.object({
  startsAt: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date"),
  initialDurationDays: z.coerce.number().int().positive(),
  reason: z.string().min(1),
});

type PremiumGrantFormValues = z.infer<typeof premiumGrantFormSchema>;

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (days?: number) => {
  if (days === undefined || Number.isNaN(days)) return "—";
  return `${days}d`;
};

const formatStatus = (value?: string) => {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

export default function AdminPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("products");
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [premiumDialogUser, setPremiumDialogUser] = useState<z.infer<typeof adminUserSchema> | null>(null);
  const [editProduct, setEditProduct] = useState<z.infer<typeof adminProductSchema> | null>(null);

  const accessToken = session?.accessToken;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  const premiumReasonOptions = useMemo(
    () => [
      { value: "trial_extension", label: t.admin.users.premium.reasons.trialExtension },
      { value: "support", label: t.admin.users.premium.reasons.support },
      { value: "marketing", label: t.admin.users.premium.reasons.marketing },
      { value: "partner", label: t.admin.users.premium.reasons.partner },
      { value: "other", label: t.admin.users.premium.reasons.other },
    ],
    [t.admin.users.premium.reasons]
  );

  const premiumForm = useForm<PremiumGrantFormValues>({
    resolver: zodResolver(premiumGrantFormSchema),
    defaultValues: {
      startsAt: formatDateTimeLocal(new Date()),
      initialDurationDays: 30,
      reason: premiumReasonOptions[0]?.value ?? "",
    },
  });

  const editForm = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      sku: "",
      productUrl: "",
      fuelType: "other",
      caloriesKcal: 0,
      carbsGrams: 0,
      sodiumMg: 0,
      proteinGrams: 0,
      fatGrams: 0,
    },
  });

  useEffect(() => {
    if (!premiumDialogOpen) {
      premiumForm.reset({
        startsAt: formatDateTimeLocal(new Date()),
        initialDurationDays: 30,
        reason: premiumReasonOptions[0]?.value ?? "",
      });
      return;
    }

    if (premiumDialogUser) {
      premiumForm.reset({
        startsAt: formatDateTimeLocal(new Date()),
        initialDurationDays: 30,
        reason: premiumReasonOptions[0]?.value ?? "",
      });
    }
  }, [premiumDialogOpen, premiumDialogUser, premiumForm, premiumReasonOptions]);

  useEffect(() => {
    editForm.reset({
      name: editProduct?.name ?? "",
      slug: editProduct?.slug ?? "",
      sku: editProduct?.sku ?? "",
      productUrl: editProduct?.productUrl ?? "",
      fuelType: (fuelTypeValues as readonly string[]).includes(editProduct?.fuelType ?? "") ? (editProduct?.fuelType as EditProductFormValues["fuelType"]) : "other",
      caloriesKcal: editProduct?.caloriesKcal ?? 0,
      carbsGrams: editProduct?.carbsGrams ?? 0,
      sodiumMg: editProduct?.sodiumMg ?? 0,
      proteinGrams: editProduct?.proteinGrams ?? 0,
      fatGrams: editProduct?.fatGrams ?? 0,
    });
  }, [editProduct, editForm]);

  const productsQuery = useQuery({
    queryKey: ["admin", "products", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.products.loadError);

      const response = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.loadError;
        throw new Error(message);
      }

      const parsed = z.object({ products: z.array(adminProductSchema) }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.loadError);
      }

      return parsed.data.products;
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (payload: { id: string; isLive?: boolean; isArchived?: boolean }) => {
      if (!accessToken) throw new Error(t.admin.products.messages.error);

      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ product: adminProductSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.messages.error);
      }

      return parsed.data.product;
    },
    onSuccess: () => {
      setProductError(null);
      setProductMessage(t.admin.products.messages.updated);
      void productsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.products.messages.error;
      setProductError(message);
      setProductMessage(null);
    },
  });

  const editProductMutation = useMutation({
    mutationFn: async (payload: { id: string } & EditProductFormValues) => {
      if (!accessToken) throw new Error(t.admin.products.messages.error);

      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: payload.id,
          name: payload.name,
          slug: payload.slug,
          sku: payload.sku || undefined,
          productUrl: payload.productUrl || undefined,
          fuelType: payload.fuelType,
          caloriesKcal: payload.caloriesKcal,
          carbsGrams: payload.carbsGrams,
          sodiumMg: payload.sodiumMg,
          proteinGrams: payload.proteinGrams,
          fatGrams: payload.fatGrams,
        }),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ product: adminProductSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.messages.error);
      }

      return parsed.data.product;
    },
    onSuccess: () => {
      setProductError(null);
      setProductMessage(t.admin.products.messages.updated);
      setEditProduct(null);
      void productsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.products.messages.error;
      setProductError(message);
      setProductMessage(null);
    },
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.users.loadError);

      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.loadError;
        throw new Error(message);
      }

      const parsed = adminUsersSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.loadError);
      }

      return parsed.data.users;
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async (payload: { id: string; roles: UserRoleOption[] }) => {
      if (!accessToken) throw new Error(t.admin.users.messages.error);

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ user: adminUserSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.messages.error);
      }

      return parsed.data.user;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.messages.updated);
      setUpdatingUserId(null);
      void usersQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.messages.error;
      setUserError(message);
      setUserMessage(null);
      setUpdatingUserId(null);
    },
  });

  const createPremiumGrantMutation = useMutation({
    mutationFn: async (payload: { userId: string; startsAt: string; initialDurationDays: number; reason: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.premium.messages.error;
        throw new Error(message);
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.premium.messages.error);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.created);
      setPremiumDialogOpen(false);
      setPremiumDialogUser(null);
      if (accessToken) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "users", accessToken] });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
    },
  });

  const revokePremiumGrantMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.premium.messages.error;
        throw new Error(message);
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.premium.messages.error);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.revoked);
      setRevokingGrantId(null);
      if (accessToken) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "users", accessToken] });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
      setRevokingGrantId(null);
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.analytics.loadError);

      const response = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.analytics.loadError;
        throw new Error(message);
      }

      const parsed = adminAnalyticsSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.analytics.loadError);
      }

      return parsed.data;
    },
  });

  const isLoading = sessionLoading || productsQuery.isLoading || usersQuery.isLoading || analyticsQuery.isLoading;

  const productRows = productsQuery.data ?? [];
  const userRows = usersQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const productStats = useMemo(() => analytics?.productStats ?? [], [analytics?.productStats]);
  const roleLabels = useMemo(
    () => ({
      user: t.admin.users.roles.user,
      coach: t.admin.users.roles.coach,
      admin: t.admin.users.roles.admin,
    }),
    [t.admin.users.roles]
  );

  const handlePremiumSubmit = premiumForm.handleSubmit((values) => {
    if (!premiumDialogUser) return;

    const startsAt = new Date(values.startsAt);

    if (Number.isNaN(startsAt.getTime())) {
      premiumForm.setError("startsAt", { message: t.admin.users.premium.form.errors.invalidDate });
      return;
    }

    createPremiumGrantMutation.mutate({
      userId: premiumDialogUser.id,
      startsAt: startsAt.toISOString(),
      initialDurationDays: values.initialDurationDays,
      reason: values.reason,
    });
  });

  const handleEditSubmit = editForm.handleSubmit((values) => {
    if (!editProduct) return;
    editProductMutation.mutate({ id: editProduct.id, ...values });
  });

  const getUserRoles = (user: z.infer<typeof adminUserSchema>): UserRoleOption[] => {
    const roles = (user.roles ?? (user.role ? [user.role] : [])) as UserRoleOption[];
    return roles.length > 0 ? roles : ["user"];
  };

  const renderStatusPill = (product: z.infer<typeof adminProductSchema>) => {
    if (product.isArchived) {
      return (
        <span className={`${basePillClass} bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
          {t.admin.products.status.archived}
        </span>
      );
    }
    if (product.isLive) {
      return (
        <span className={`${basePillClass} bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200`}>
          {t.admin.products.status.live}
        </span>
      );
    }
    return (
      <span className={`${basePillClass} bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200`}>
        {t.admin.products.status.draft}
      </span>
    );
  };

  if (sessionLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.access.checking}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.access.signIn}</p>
        <div>
          <Link href="/sign-in">
            <Button>{t.admin.access.signInCta}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-amber-700 dark:text-amber-200">{t.admin.access.forbidden}</p>
        <div className="flex items-center gap-3">
          <Link href="/race-planner" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{t.admin.title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t.admin.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/race-planner" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.homeHero.cta}
          </Link>
          <Link href="/settings" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
            {t.navigation.settings}
          </Link>
        </div>
      </div>

      <TabsList
        tabs={[
          { id: "products", label: t.admin.products.title },
          { id: "users", label: t.admin.users.title },
          { id: "races", label: t.admin.raceCatalog.title },
          { id: "growth", label: t.admin.growth.title },
          { id: "analytics", label: t.admin.analytics.title },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "products" && (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.products.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.products.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {productMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{productMessage}</p> : null}
            {productError || productsQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {productError ??
                  (productsQuery.error instanceof Error
                    ? productsQuery.error.message
                    : t.admin.products.loadError)}
              </p>
            ) : null}

            {isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.access.checking}</p>
            ) : null}

            {!isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.products.empty}</p>
            ) : null}

            {productRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.name}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.status}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.updated}</TableHead>
                    <TableHead className="text-right text-slate-600 dark:text-slate-300">
                      {t.admin.products.table.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                        {product.name}
                      </TableCell>
                      <TableCell>{renderStatusPill(product)}</TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {formatDate(product.updatedAt)}
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending || editProductMutation.isPending}
                          onClick={() => setEditProduct(product)}
                        >
                          {t.admin.products.actions.edit}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isLive: true,
                              isArchived: false,
                            })
                          }
                        >
                          {t.admin.products.actions.setLive}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isLive: false,
                              isArchived: false,
                            })
                          }
                        >
                          {t.admin.products.actions.setDraft}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isArchived: !product.isArchived,
                              isLive: product.isArchived ? product.isLive : false,
                            })
                          }
                        >
                          {product.isArchived ? t.admin.products.actions.restore : t.admin.products.actions.archive}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        <Dialog
          open={editProduct !== null}
          onOpenChange={(open) => {
            if (!open) setEditProduct(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.admin.products.editDialog.title}</DialogTitle>
              <DialogDescription>{editProduct?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-product-name">{t.admin.products.editDialog.name}</Label>
                <Input id="edit-product-name" {...editForm.register("name")} />
                {editForm.formState.errors.name ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-slug">{t.admin.products.editDialog.slug}</Label>
                <Input id="edit-product-slug" {...editForm.register("slug")} />
                {editForm.formState.errors.slug ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.slug.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-sku">{t.admin.products.editDialog.sku}</Label>
                <Input id="edit-product-sku" {...editForm.register("sku")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-url">{t.admin.products.editDialog.productUrl}</Label>
                <Input id="edit-product-url" type="url" {...editForm.register("productUrl")} />
                {editForm.formState.errors.productUrl ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.productUrl.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-fuel-type">{t.admin.products.editDialog.fuelType}</Label>
                <select
                  id="edit-product-fuel-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  {...editForm.register("fuelType")}
                >
                  {fuelTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-product-calories">{t.admin.products.editDialog.caloriesKcal}</Label>
                  <Input id="edit-product-calories" type="number" min="0" {...editForm.register("caloriesKcal")} />
                  {editForm.formState.errors.caloriesKcal ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.caloriesKcal.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-product-carbs">{t.admin.products.editDialog.carbsGrams}</Label>
                  <Input id="edit-product-carbs" type="number" min="0" {...editForm.register("carbsGrams")} />
                  {editForm.formState.errors.carbsGrams ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.carbsGrams.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-product-sodium">{t.admin.products.editDialog.sodiumMg}</Label>
                  <Input id="edit-product-sodium" type="number" min="0" {...editForm.register("sodiumMg")} />
                  {editForm.formState.errors.sodiumMg ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.sodiumMg.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-product-protein">{t.admin.products.editDialog.proteinGrams}</Label>
                  <Input id="edit-product-protein" type="number" min="0" {...editForm.register("proteinGrams")} />
                  {editForm.formState.errors.proteinGrams ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.proteinGrams.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-product-fat">{t.admin.products.editDialog.fatGrams}</Label>
                  <Input id="edit-product-fat" type="number" min="0" {...editForm.register("fatGrams")} />
                  {editForm.formState.errors.fatGrams ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.fatGrams.message}</p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditProduct(null)}
                >
                  {t.admin.products.editDialog.cancel}
                </Button>
                <Button type="submit" disabled={editProductMutation.isPending}>
                  {editProductMutation.isPending
                    ? t.admin.products.editDialog.saving
                    : t.admin.products.editDialog.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </>
      )}

      {activeTab === "users" && (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.users.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.users.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {userMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{userMessage}</p> : null}
            {userError ? <p className="text-sm text-red-600 dark:text-red-300">{userError}</p> : null}
            {usersQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {usersQuery.error instanceof Error ? usersQuery.error.message : t.admin.users.loadError}
              </p>
            ) : null}

            {isLoading && userRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.access.checking}</p>
            ) : null}

            {!isLoading && userRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.users.empty}</p>
            ) : null}

            {userRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.email}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.role}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.createdAt}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.users.table.lastSignInAt}
                    </TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.users.table.premium}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        {user.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        <div className="flex flex-wrap items-center gap-3">
                          {userRoleOptions.map((option) => {
                            const activeRoles = getUserRoles(user);
                            const isChecked = activeRoles.includes(option);
                            return (
                              <label
                                key={option}
                                className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-400"
                                  checked={isChecked}
                                  onChange={() => {
                                    const currentRoles = getUserRoles(user);
                                    const nextRoles: UserRoleOption[] = isChecked
                                      ? currentRoles.filter((role) => role !== option)
                                      : [...currentRoles, option];
                                    const normalizedRoles: UserRoleOption[] =
                                      nextRoles.length > 0 ? nextRoles : ["user"];
                                    setUpdatingUserId(user.id);
                                    updateUserRoleMutation.mutate({ id: user.id, roles: normalizedRoles });
                                  }}
                                  disabled={updateUserRoleMutation.isPending && updatingUserId === user.id}
                                />
                                <span>{roleLabels[option]}</span>
                              </label>
                            );
                          })}
                          {updateUserRoleMutation.isPending && updatingUserId === user.id ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {t.admin.users.messages.updating}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {formatDate(user.lastSignInAt)}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        <div className="space-y-2">
                          {user.subscription ? (
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.subscription.label}</span>{" "}
                                {formatStatus(user.subscription.status)}
                              </div>
                              {user.subscription.currentPeriodEnd ? (
                                <div>
                                  <span className="font-semibold">{t.admin.users.premium.subscription.ends}</span>{" "}
                                  {formatDate(user.subscription.currentPeriodEnd)}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {user.trial ? (
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.trial.label}</span>{" "}
                                {formatDate(user.trial.endsAt)}
                              </div>
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.trial.remaining}</span>{" "}
                                {formatDuration(user.trial.remainingDays)}
                              </div>
                            </div>
                          ) : null}
                          {user.premiumGrant ? (
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.starts}</span>{" "}
                                {formatDate(user.premiumGrant.startsAt)}
                              </div>
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.duration}</span>{" "}
                                {formatDuration(user.premiumGrant.initialDurationDays)}
                              </div>
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.remaining}</span>{" "}
                                {formatDuration(user.premiumGrant.remainingDurationDays)}
                              </div>
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.reason}</span>{" "}
                                {user.premiumGrant.reason}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                                onClick={() => {
                                  if (!user.premiumGrant) return;
                                  setRevokingGrantId(user.premiumGrant.id);
                                  revokePremiumGrantMutation.mutate({ id: user.premiumGrant.id });
                                }}
                                disabled={
                                  revokePremiumGrantMutation.isPending && revokingGrantId === user.premiumGrant.id
                                }
                              >
                                {revokePremiumGrantMutation.isPending && revokingGrantId === user.premiumGrant.id
                                  ? t.admin.users.premium.revoke.loading
                                  : t.admin.users.premium.revoke.action}
                              </Button>
                            </div>
                          ) : null}
                          {!user.premiumGrant && !user.trial && !user.subscription ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t.admin.users.premium.empty}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              setPremiumDialogUser(user);
                              setPremiumDialogOpen(true);
                            }}
                            disabled={createPremiumGrantMutation.isPending}
                          >
                            {t.admin.users.premium.action}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        <Dialog
          open={premiumDialogOpen}
          onOpenChange={(open) => {
            setPremiumDialogOpen(open);
            if (!open) {
              setPremiumDialogUser(null);
              premiumForm.reset({
                startsAt: formatDateTimeLocal(new Date()),
                initialDurationDays: 30,
                reason: premiumReasonOptions[0]?.value ?? "",
              });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.admin.users.premium.form.title}</DialogTitle>
              <DialogDescription>{t.admin.users.premium.form.description}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePremiumSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="premium-starts-at">{t.admin.users.premium.form.startsAtLabel}</Label>
                <Input
                  id="premium-starts-at"
                  type="datetime-local"
                  {...premiumForm.register("startsAt")}
                />
                {premiumForm.formState.errors.startsAt ? (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {premiumForm.formState.errors.startsAt.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-duration">{t.admin.users.premium.form.durationLabel}</Label>
                <Input
                  id="premium-duration"
                  type="number"
                  min="1"
                  {...premiumForm.register("initialDurationDays", { valueAsNumber: true })}
                />
                {premiumForm.formState.errors.initialDurationDays ? (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {premiumForm.formState.errors.initialDurationDays.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-reason">{t.admin.users.premium.form.reasonLabel}</Label>
                <select
                  id="premium-reason"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  {...premiumForm.register("reason")}
                >
                  {premiumReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {premiumForm.formState.errors.reason ? (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {premiumForm.formState.errors.reason.message}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPremiumDialogOpen(false);
                    setPremiumDialogUser(null);
                  }}
                >
                  {t.admin.users.premium.form.cancel}
                </Button>
                <Button type="submit" disabled={createPremiumGrantMutation.isPending}>
                  {createPremiumGrantMutation.isPending
                    ? t.admin.users.premium.form.submitting
                    : t.admin.users.premium.form.submit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </>
      )}

      {activeTab === "races" && (
        <AdminRaceCatalogSection accessToken={accessToken} t={t.admin.raceCatalog} />
      )}

      {activeTab === "growth" && (
        <AdminGrowthSection accessToken={accessToken} t={t.admin.growth} />
      )}

      {activeTab === "analytics" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.analytics.title}</CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.analytics.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {analyticsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-300">
              {analyticsQuery.error instanceof Error ? analyticsQuery.error.message : t.admin.analytics.loadError}
            </p>
          ) : null}

          {analytics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.admin.analytics.totals.popupOpens}
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {analytics.totals.popupOpens}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.admin.analytics.totals.clicks}
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {analytics.totals.clicks}
                </p>
              </div>
            </div>
          ) : null}

          {productStats.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t.admin.analytics.statsTitle}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {productStats.map((stat) => (
                  <div
                    key={stat.productId}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {stat.productName ?? stat.productId}
                      </p>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {t.admin.analytics.totals.popupOpens}: {stat.popupOpens}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-200">
                      {t.admin.analytics.totals.clicks}: {stat.clicks}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analytics && analytics.recentEvents.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.analytics.empty}</p>
          ) : null}

          {analytics && analytics.recentEvents.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t.admin.analytics.eventsTitle}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.analytics.table.product}
                    </TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.analytics.table.eventType}
                    </TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.analytics.table.country}
                    </TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.analytics.table.merchant}
                    </TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">
                      {t.admin.analytics.table.timestamp}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                        {event.productName ?? event.productId}
                      </TableCell>
                      <TableCell className="capitalize text-slate-700 dark:text-slate-200">
                        {event.eventType.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {event.countryCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {event.merchant ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {formatDate(event.occurredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
        </Card>
      )}
    </div>
  );
}
