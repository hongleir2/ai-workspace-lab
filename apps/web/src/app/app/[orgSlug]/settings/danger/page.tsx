import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DangerSettingsPage() {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base text-destructive">{'Danger Zone'}</CardTitle>
          <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">
            {'Owner only'}
          </Badge>
        </div>
        <CardDescription>{'Irreversible actions for this organization.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive/40" />
          <p className="text-sm text-muted-foreground">
            {'Organization deletion and other destructive actions are coming in a future sprint.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {'Only owners can perform these actions.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
