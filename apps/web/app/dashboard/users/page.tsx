"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  RefreshCcw,
  SquarePen,
  UserCheck,
  UserCog,
  UserX,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { userApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  DataCard,
  EmptyRow,
  ErrorRow,
  FilterChips,
  NoResultsRow,
  PageHeader,
  PaginationBar,
  TableSkeleton,
  TableToolbar,
  useConfirm,
  useTableControls,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface UserRecord {
  _id: string;
  name?: string;
  email: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string;
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "inactive"];
const ROLES = ["USER", "AGENT", "ADMIN"] as const;
const COLUMN_COUNT = 5;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function initialsOf(user: UserRecord) {
  return (
    (user.name ?? user.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "ADMIN") return <Badge>Admin</Badge>;
  if (role === "AGENT") return <Badge variant="secondary">Agent</Badge>;
  return <Badge variant="outline">{role ?? "User"}</Badge>;
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userApi.getAll();
      // The old version assigned the response straight into state, so a
      // non-array payload made the render crash on .filter.
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load users. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    let active = 0;
    const byRole: Record<string, number> = {};
    for (const user of users) {
      if (user.isActive !== false) active += 1;
      const role = user.role ?? "USER";
      byRole[role] = (byRole[role] ?? 0) + 1;
    }
    return {
      all: users.length,
      active,
      inactive: users.length - active,
      byRole,
    };
  }, [users]);

  const rowFilter = useCallback(
    (user: UserRecord) => {
      const isActive = user.isActive !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (roleFilter !== "all" && (user.role ?? "USER") !== roleFilter)
        return false;
      return true;
    },
    [statusFilter, roleFilter],
  );

  const table = useTableControls<UserRecord>({
    data: users,
    searchKeys: ["name", "email", "role"],
    filter: rowFilter,
    initialPageSize: 25,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, roleFilter]);

  const applyLocal = (id: string, patch: Partial<UserRecord>) =>
    setUsers((previous) =>
      previous.map((item) => (item._id === id ? { ...item, ...patch } : item)),
    );

  const saveUser = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await userApi.update(editing._id, {
        role: editing.role,
        isActive: editing.isActive,
      });
      applyLocal(editing._id, {
        role: editing.role,
        isActive: editing.isActive,
      });
      toast.success("User updated");
      setEditing(null);
    } catch (err) {
      console.error("Error updating user:", err);
      toast.error("Could not update user", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (user: UserRecord) => {
    const isActive = user.isActive !== false;
    const label = user.name || user.email;

    const run = async () => {
      try {
        setBusyId(user._id);
        await userApi.update(user._id, { isActive: !isActive });
        applyLocal(user._id, { isActive: !isActive });
        toast.success(isActive ? "User deactivated" : "User activated");
      } catch (err) {
        console.error("Error toggling user status:", err);
        toast.error("Could not update status", {
          description: apiErrorMessage(err, "Please try again."),
        });
      } finally {
        setBusyId(null);
      }
    };

    // Deactivating is disruptive (the account is bounced to /pending-activation),
    // so ask first. Re-activating is harmless and applies straight away.
    if (isActive) {
      confirm({
        title: "Deactivate this user?",
        description: `“${label}” will lose access to the dashboard until reactivated.`,
        confirmLabel: "Deactivate",
        onConfirm: run,
      });
      return;
    }
    void run();
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: keyof UserRecord;
    children: React.ReactNode;
  }) => {
    const active = table.sortKey === column;
    const Icon = !active
      ? ArrowUpDown
      : table.sortDirection === "asc"
        ? ArrowUp
        : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => table.toggleSort(column)}
        className={cn(
          "-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors hover:bg-accent",
          active && "text-foreground",
        )}
      >
        {children}
        <Icon
          className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")}
        />
      </button>
    );
  };

  const filtersActive =
    statusFilter !== "all" || roleFilter !== "all" || table.search !== "";
  const resetAll = () => {
    setStatusFilter("all");
    setRoleFilter("all");
    table.resetFilters();
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Users"
        description="Assign roles, activate accounts and control who can reach the dashboard."
        meta={
          !loading && (
            <>
              <Badge variant="outline">{counts.all} total</Badge>
              <Badge variant="outline">{counts.byRole.ADMIN ?? 0} admins</Badge>
              <Badge variant="outline">{counts.byRole.AGENT ?? 0} agents</Badge>
              {counts.inactive > 0 && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {counts.inactive} awaiting activation
                </Badge>
              )}
            </>
          )
        }
        actions={
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw
              className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by name or email…"
          >
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </TableToolbar>

          <FilterChips<StatusFilter>
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label: status.charAt(0).toUpperCase() + status.slice(1),
              count: counts[status],
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">
                  <SortButton column="name">User</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="role">Role</SortButton>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Joined</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={8} columns={COLUMN_COUNT} />
              ) : error ? (
                <ErrorRow
                  colSpan={COLUMN_COUNT}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : users.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={UsersIcon}
                  title="No users found"
                  description="Nobody has registered on the platform yet."
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={resetAll}
                />
              ) : (
                table.rows.map((user) => {
                  const busy = busyId === user._id;
                  const isActive = user.isActive !== false;
                  const isSelf = user._id === currentUser?._id;
                  return (
                    <TableRow
                      key={user._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {initialsOf(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              <span className="truncate">
                                {user.name || "No name"}
                              </span>
                              {isSelf && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-[10px]"
                                >
                                  You
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/*
                            Editing or deactivating your own account here would
                            lock you out of the dashboard mid-session, so both
                            are disabled for the signed-in admin.
                          */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={busy || isSelf}
                                onClick={() => setEditing({ ...user })}
                              >
                                <SquarePen className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf
                                ? "Use My Account to edit yourself"
                                : "Edit role and status"}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-8 w-8",
                                  isActive
                                    ? "text-destructive"
                                    : "text-emerald-600",
                                )}
                                disabled={busy || isSelf}
                                onClick={() => toggleStatus(user)}
                              >
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isActive ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf
                                ? "You cannot deactivate yourself"
                                : isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && !error && table.matchedCount > 0 && (
          <div className="p-5 pt-0">
            <PaginationBar
              page={table.page}
              totalPages={table.totalPages}
              pageSize={table.pageSize}
              fromIndex={table.fromIndex}
              toIndex={table.toIndex}
              matchedCount={table.matchedCount}
              itemLabel="users"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>

      {/* Edit role / status */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && !saving && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Edit user
            </DialogTitle>
            <DialogDescription>
              {editing?.name || editing?.email}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select
                  value={editing.role ?? "USER"}
                  onValueChange={(value) =>
                    setEditing({ ...editing, role: value })
                  }
                >
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User — browse only</SelectItem>
                    <SelectItem value="AGENT">
                      Agent — manage own listings
                    </SelectItem>
                    <SelectItem value="ADMIN">Admin — full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={editing.isActive !== false ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setEditing({ ...editing, isActive: value === "active" })
                  }
                >
                  <SelectTrigger id="user-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active — can sign in</SelectItem>
                    <SelectItem value="inactive">
                      Inactive — access blocked
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.role === "ADMIN" && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Admins can manage every listing, rate and user on the
                  platform.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveUser()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
