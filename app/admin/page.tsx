"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";

const adminProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  name: z.string(),
  productUrl: z.string().optional(),
  isLive: z.boolean(),
  isArchived: z.boolean(),
  updatedAt: z.string(),
});

const adminUsersSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().email().optional(),
      createdAt: z.string(),
      lastSignInAt: z.string().optional(),
      role: z.string().optional(),
    })
  ),
});

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

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function AdminPage() {
  const { t } = useI18n();
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const accessToken = session?.accessToken;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

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

  const renderStatusPill = (product: z.infer<typeof adminProductSchema>) => {
    if (product.isArchived) {
      return <span className={`${basePillClass} bg-slate-800 text-slate-100`}>{t.admin.products.status.archived}</span>;
    }
    if (product.isLive) {
      return <span className={`${basePillClass} bg-emerald-400/20 text-emerald-200`}>{t.admin.products.status.live}</span>;
    }
    return <span className={`${basePillClass} bg-amber-400/20 text-amber-200`}>{t.admin.products.status.draft}</span>;
  };

  if (sessionLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-300">{t.admin.access.checking}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-slate-300">{t.admin.access.signIn}</p>
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
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-50">{t.admin.title}</h1>
        <p className="text-sm text-amber-200">{t.admin.access.forbidden}</p>
        <div className="flex items-center gap-3">
          <Link href="/race-planner" className="text-emerald-200 underline-offset-4 hover:underline">
            {t.homeHero.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{t.admin.title}</h1>
          <p className="text-sm text-slate-300">{t.admin.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/race-planner" className="text-emerald-200 underline-offset-4 hover:underline">
            {t.homeHero.cta}
          </Link>
          <Link href="/settings" className="text-emerald-200 underline-offset-4 hover:underline">
            {t.navigation.settings}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-slate-50">{t.admin.products.title}</CardTitle>
            <p className="text-sm text-slate-400">{t.admin.products.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {productMessage ? <p className="text-sm text-emerald-200">{productMessage}</p> : null}
            {productError || productsQuery.error ? (
              <p className="text-sm text-red-300">
                {productError ??
                  (productsQuery.error instanceof Error
                    ? productsQuery.error.message
                    : t.admin.products.loadError)}
              </p>
            ) : null}

            {isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-400">{t.admin.access.checking}</p>
            ) : null}

            {!isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-400">{t.admin.products.empty}</p>
            ) : null}

            {productRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.products.table.name}</TableHead>
                    <TableHead>{t.admin.products.table.status}</TableHead>
                    <TableHead>{t.admin.products.table.updated}</TableHead>
                    <TableHead className="text-right">{t.admin.products.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-semibold text-slate-50">{product.name}</TableCell>
                      <TableCell>{renderStatusPill(product)}</TableCell>
                      <TableCell>{formatDate(product.updatedAt)}</TableCell>
                      <TableCell className="flex justify-end gap-2">
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

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg text-slate-50">{t.admin.users.title}</CardTitle>
            <p className="text-sm text-slate-400">{t.admin.users.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {usersQuery.error ? (
              <p className="text-sm text-red-300">
                {usersQuery.error instanceof Error ? usersQuery.error.message : t.admin.users.loadError}
              </p>
            ) : null}

            {isLoading && userRows.length === 0 ? (
              <p className="text-sm text-slate-400">{t.admin.access.checking}</p>
            ) : null}

            {!isLoading && userRows.length === 0 ? (
              <p className="text-sm text-slate-400">{t.admin.users.empty}</p>
            ) : null}

            {userRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.users.table.email}</TableHead>
                    <TableHead>{t.admin.users.table.role}</TableHead>
                    <TableHead>{t.admin.users.table.createdAt}</TableHead>
                    <TableHead>{t.admin.users.table.lastSignInAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold text-slate-50">{user.email ?? "—"}</TableCell>
                      <TableCell className="text-slate-200">{user.role ?? "—"}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.lastSignInAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-50">{t.admin.analytics.title}</CardTitle>
          <p className="text-sm text-slate-400">{t.admin.analytics.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {analyticsQuery.error ? (
            <p className="text-sm text-red-300">
              {analyticsQuery.error instanceof Error ? analyticsQuery.error.message : t.admin.analytics.loadError}
            </p>
          ) : null}

          {analytics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-400">{t.admin.analytics.totals.popupOpens}</p>
                <p className="text-2xl font-semibold text-slate-50">{analytics.totals.popupOpens}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-400">{t.admin.analytics.totals.clicks}</p>
                <p className="text-2xl font-semibold text-slate-50">{analytics.totals.clicks}</p>
              </div>
            </div>
          ) : null}

          {productStats.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-200">{t.admin.analytics.statsTitle}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {productStats.map((stat) => (
                  <div key={stat.productId} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-50">{stat.productName ?? stat.productId}</p>
                      <span className="text-xs text-slate-400">
                        {t.admin.analytics.totals.popupOpens}: {stat.popupOpens}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200">
                      {t.admin.analytics.totals.clicks}: {stat.clicks}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analytics && analytics.recentEvents.length === 0 ? (
            <p className="text-sm text-slate-400">{t.admin.analytics.empty}</p>
          ) : null}

          {analytics && analytics.recentEvents.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-200">{t.admin.analytics.eventsTitle}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.analytics.table.product}</TableHead>
                    <TableHead>{t.admin.analytics.table.eventType}</TableHead>
                    <TableHead>{t.admin.analytics.table.country}</TableHead>
                    <TableHead>{t.admin.analytics.table.merchant}</TableHead>
                    <TableHead>{t.admin.analytics.table.timestamp}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-semibold text-slate-50">{event.productName ?? event.productId}</TableCell>
                      <TableCell className="capitalize text-slate-200">{event.eventType.replace("_", " ")}</TableCell>
                      <TableCell>{event.countryCode ?? "—"}</TableCell>
                      <TableCell>{event.merchant ?? "—"}</TableCell>
                      <TableCell>{formatDate(event.occurredAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
