import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Badge } from '@project/components/ui/badge';

interface Props {
  open: boolean;
  userName: string;
  oldRole: string;
  newRole: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RoleChangeDialog({ open, userName, oldRole, newRole, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">
                You are about to change the role for <span className="font-semibold text-foreground">{userName}</span>:
              </p>
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                <Badge variant="secondary" className="text-xs">{oldRole || '—'}</Badge>
                <span className="text-muted-foreground text-sm">→</span>
                <Badge className="text-xs">{newRole}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">This change will be logged in the audit trail and take effect immediately.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm Change</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
