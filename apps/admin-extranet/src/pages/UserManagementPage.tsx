import { useEffect, useState } from 'react';
import { getUsers, GetUsersOutputType, updateUserRole, getAuditLog, GetAuditLogOutputType, resetUserPassword, deleteUser, updateUser } from 'zitejs/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserCog, Eye, EyeOff, Check, Pencil, ShieldCheck, Clock, UserPlus, Lock, Trash2 } from 'lucide-react';
import { DMC_ROLES, DmcRole } from '@/hooks/useRole';
import { getSessionUserId } from '@/hooks/useAppAuth';
import RoleChangeDialog from '@/components/RoleChangeDialog';
import AddUserDialog from '@/components/AddUserDialog';
import EditUserDialog from '@/components/EditUserDialog';
import { formatDistanceToNow } from 'date-fns';

const MAIN_ADMIN_EMAIL = 'rammy.yadav@gmail.com';

type User = GetUsersOutputType[0];
type AuditEntry = GetAuditLogOutputType[0];

const ROLE_BADGE: Record<string, string> = {
  'Admin':               'bg-purple-100 text-purple-800 border-purple-200',
  'Contracting Team': 'bg-blue-100 text-blue-800 border-blue-200',
  'Sales Manager':       'bg-green-100 text-green-800 border-green-200',
  'Finance Controller':  'bg-orange-100 text-orange-800 border-orange-200',
  'Reservations Agent':  'bg-teal-100 text-teal-800 border-teal-200',
  'Read Only':           'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_BADGE: Record<string, string> = {
  'Active':    'bg-green-100 text-green-700',
  'Inactive':  'bg-gray-100 text-gray-500',
  'Suspended': 'bg-red-100 text-red-700',
};

function PasswordCell({ user, onSave }: { user: User; onSave: (id: string, pw: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user.password ?? '');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try { await onSave(user.id, value.trim()); toast.success('Password updated'); setEditing(false); }
    catch { toast.error('Failed to update password'); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={e => setValue(e.target.value)}
          className="h-7 text-xs w-32 pr-7" placeholder="New password"
          onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>
      <Button size="sm" className="h-7 px-2" onClick={handleSave} disabled={saving}><Check className="w-3 h-3" /></Button>
    </div>
  );

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-muted-foreground">
        {user.password ? (show ? user.password : '••••••••') : <span className="italic">not set</span>}
      </span>
      {user.password && <button onClick={() => setShow(s => !s)} className="text-muted-foreground hover:text-foreground">{show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>}
      <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary"><Pencil className="w-3 h-3" /></button>
    </div>
  );
}

function UserRow({ user, onRoleChangeRequest, onPasswordSave, onEdit, onDelete, onStatusChange }: {
  user: User;
  onRoleChangeRequest: (user: User, newRole: string) => void;
  onPasswordSave: (id: string, pw: string) => Promise<void>;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onStatusChange: (user: User, status: string) => void;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const roleCls = ROLE_BADGE[user.role ?? ''] ?? 'bg-muted text-muted-foreground border-border';
  const statusCls = STATUS_BADGE[user.status ?? 'Active'] ?? STATUS_BADGE['Active'];
  const isMainAdmin = user.email === MAIN_ADMIN_EMAIL;

  return (
    <tr className={`border-b border-border transition-colors ${isMainAdmin ? 'bg-purple-50/40' : 'hover:bg-muted/20'}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMainAdmin ? 'bg-purple-100' : 'bg-primary/10'}`}>
            <span className={`text-xs font-bold ${isMainAdmin ? 'text-purple-700' : 'text-primary'}`}>{(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground leading-none">{fullName}</p>
              {isMainAdmin && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  <Lock className="w-2.5 h-2.5" />Protected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{user.companyName || '—'}</td>
      <td className="px-4 py-3">
        {isMainAdmin ? (
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleCls}`}>{user.role || '—'}</span>
            <Lock className="w-3 h-3 text-purple-400" />
          </div>
        ) : (
          <Select value={user.role ?? ''} onValueChange={v => onRoleChangeRequest(user, v)}>
            <SelectTrigger className="h-7 text-xs w-44 border-0 bg-transparent p-0 focus:ring-0 shadow-none">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleCls}`}>{user.role || '—'}</span>
            </SelectTrigger>
            <SelectContent>
              {DMC_ROLES.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {isMainAdmin ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{user.status || 'Active'}</span>
        ) : (
          <Select value={user.status ?? 'Active'} onValueChange={v => onStatusChange(user, v)}>
            <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0 focus:ring-0 shadow-none">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{user.status || 'Active'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active" className="text-xs">Active</SelectItem>
              <SelectItem value="Inactive" className="text-xs">Inactive</SelectItem>
              <SelectItem value="Suspended" className="text-xs">Suspended</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <PasswordCell user={user} onSave={onPasswordSave} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Edit user"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {!isMainAdmin && (
            <button
              onClick={() => onDelete(user)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete user"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AuditLogTable({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {['User Changed', 'Changed By', 'Old Role', 'New Role', 'Date'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <tr key={i} className="border-b border-border">
              {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
            </tr>
          )) : entries.map(e => (
            <tr key={e.id} className="border-b border-border hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{e.userChanged}</p>
                <p className="text-xs text-muted-foreground">{e.userEmail}</p>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{e.changedBy}</td>
              <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE[e.oldRole ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>{e.oldRole || '—'}</span></td>
              <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE[e.newRole ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>{e.newRole}</span></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{e.date ? formatDistanceToNow(new Date(e.date), { addSuffix: true }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && entries.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">No audit entries yet.</div>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [pending, setPending] = useState<{ user: User; newRole: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshUsers = () => getUsers({}).then(d => setUsers(d));

  useEffect(() => {
    refreshUsers().then(() => setLoadingUsers(false)).catch(() => setLoadingUsers(false));
    getAuditLog({ actingUserId: getSessionUserId() })
      .then(d => setAuditLog(d))
      .catch(() => setAuditLog([]))
      .finally(() => setLoadingAudit(false));
  }, []);

  const handleRoleChangeRequest = (user: User, newRole: string) => {
    if (newRole === user.role) return;
    setPending({ user, newRole });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setConfirming(true);
    const { user, newRole } = pending;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id;
    try {
      await updateUserRole({ userId: user.id, role: newRole as DmcRole, oldRole: user.role, userName: fullName, userEmail: user.email, actingUserId: getSessionUserId() });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      getAuditLog({ actingUserId: getSessionUserId() }).then(d => setAuditLog(d)).catch(() => {});
      toast.success(`Role updated to ${newRole}`);
    } catch { toast.error('Failed to update role'); }
    finally { setConfirming(false); setPending(null); }
  };

  const handlePasswordSave = async (userId: string, password: string) => {
    await resetUserPassword({ userId, password, actingUserId: getSessionUserId() });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password } : u));
  };

  const handleEditSaved = (updated: Partial<User>) => {
    if (!editUser) return;
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updated } : u));
  };

  const handleStatusChange = async (user: User, status: string) => {
    if (status === user.status) return;
    try {
      await updateUser({ userId: user.id, status: status as 'Active' | 'Inactive' | 'Suspended', actingUserId: getSessionUserId() });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status } : u));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser({ userId: deleteTarget.id, actingUserId: getSessionUserId() });
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      toast.success(`User deleted successfully.`);
    } catch { toast.error('Failed to delete user.'); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const pendingUserName = pending ? ([pending.user.firstName, pending.user.lastName].filter(Boolean).join(' ') || pending.user.email || '') : '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserCog className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage DMC staff access &amp; permissions</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium hidden sm:flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />{users.length} staff members</span>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4" />Add User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-5">
          <TabsTrigger value="users" className="gap-1.5"><UserCog className="w-3.5 h-3.5" />Staff Users</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><Clock className="w-3.5 h-3.5" />Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name / Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Password</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3"><Skeleton className="h-8 w-48" /></td>
                        <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-28" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-36" /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                      </tr>
                    ))
                  : users.map(u => (
                      <UserRow
                        key={u.id}
                        user={u}
                        onRoleChangeRequest={handleRoleChangeRequest}
                        onPasswordSave={handlePasswordSave}
                        onEdit={setEditUser}
                        onDelete={setDeleteTarget}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                }
              </tbody>
            </table>
            {!loadingUsers && users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No users found.</div>
            )}
          </div>

          {/* Role legend */}
          <div className="mt-5 p-4 rounded-xl border border-border bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Role Permissions Summary</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { role: 'Admin', desc: 'Full access: users, hotels, rates, bookings, finance, reports, delete' },
                { role: 'Contracting Team', desc: 'Hotels, room types, rate plans, net rates, promotions, blackout dates' },
                { role: 'Sales Manager', desc: 'Markup rules, booking reports, reservations, rate sheet' },
                { role: 'Finance Controller', desc: 'Invoices, payments, ledger, agent credit, financial reports' },
                { role: 'Reservations Agent', desc: 'Bookings, confirmations, LPO, vouchers, cancellations, MICE' },
                { role: 'Read Only', desc: 'Dashboard & reports only — no edits allowed' },
              ].map(({ role, desc }) => (
                <div key={role} className="flex gap-2.5 items-start">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${ROLE_BADGE[role]}`}>{role}</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTable entries={auditLog} loading={loadingAudit} />
        </TabsContent>
      </Tabs>

      <AddUserDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); refreshUsers(); }}
      />

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSaved={handleEditSaved}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{[deleteTarget?.firstName, deleteTarget?.lastName].filter(Boolean).join(' ') || deleteTarget?.email}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RoleChangeDialog
        open={!!pending}
        userName={pendingUserName}
        oldRole={pending?.user.role ?? ''}
        newRole={pending?.newRole ?? ''}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)
        }
      />
    </div>
  );
}
