"use client";

import type { Route } from "next";
import Link from "next/link";

import { cn } from "../../../../components/utils";
import { ADMIN_NAV, findActiveNavItem, type AdminCountKey } from "../../admin-routes";
import { AdminNavIcon } from "./AdminNavIcon";

type AdminSidebarProps = {
  pathname: string;
  counts: Partial<Record<AdminCountKey, number | undefined>>;
  email?: string;
  /** Closes the mobile drawer after a navigation. */
  onNavigate?: () => void;
};

const initialsOf = (email: string | undefined) => {
  const name = (email ?? "").split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
};

/** Dark green console sidebar: one entry per domain, grouped as in the ADR, pending counts on the right. */
export function AdminSidebar({ pathname, counts, email, onNavigate }: AdminSidebarProps) {
  const active = findActiveNavItem(pathname);
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto bg-[#1f2a12] px-3 py-[18px] text-[#dfe6d3]">
      <Link
        href={"/admin" as Route}
        onClick={onNavigate}
        className="mb-2 flex items-center gap-2.5 rounded-lg px-2.5 pb-3 pt-1 text-base font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8d44e]"
      >
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-[#c8d44e] font-extrabold text-[#1f2a12]">
          P
        </span>
        <span>
          Pace Yourself
          <small className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#9fae8a]">Console admin</small>
        </span>
      </Link>

      <nav aria-label="Administration" className="flex flex-col gap-1">
        {ADMIN_NAV.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-0.5">
            {group.label ? (
              <p className="mx-2.5 mb-1.5 mt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8b9a76]">{group.label}</p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = active?.href === item.href;
                const count = item.count ? counts[item.count] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href as Route}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-9 items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#c8d44e]",
                        isActive ? "bg-[rgba(200,212,78,0.14)] text-white shadow-[inset_2px_0_0_#c8d44e]" : "text-[#cfd8c2] hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <AdminNavIcon name={item.icon} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count ? (
                        <span className="ml-auto rounded-full bg-[#f0873a] px-[7px] py-px font-mono text-[11px] font-semibold text-white">
                          <span className="sr-only">, </span>
                          {count}
                          <span className="sr-only"> en attente</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-white/[0.08] px-2.5 pt-3 text-xs text-[#9fae8a]">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#3b6a1d] text-xs font-bold text-white">
            {initialsOf(email)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{email ?? "Administrateur"}</p>
            <p>Administrateur</p>
          </div>
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 rounded-md py-1 text-[#cfd8c2] underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8d44e]"
        >
          <span aria-hidden="true">←</span> Retour au site
        </Link>
      </div>
    </div>
  );
}
