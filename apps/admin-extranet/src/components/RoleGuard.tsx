import { useRole, AppRole } from '@/hooks/useRole';
import { ShieldOff } from 'lucide-react';

interface Props {
  allowedRoles: AppRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RoleGuard({ allowedRoles, children }: Props) {
  const { roles, isAdmin, isLoading } = useRole();

  if (isLoading) return null;

  // Admin always passes; otherwise check if ANY of the user's roles is allowed
  const hasAccess = isAdmin || roles.some(r => allowedRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm">
          Your role <span className="font-medium text-foreground">({roles.join(', ')})</span> does not have
          permission to view this page. Please contact your administrator.
        </p>
        <a href="/" className="text-primary text-sm underline underline-offset-4">
          Return to Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
