import { Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MembersSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{'Members'}</CardTitle>
        <CardDescription>{'Manage who has access to this organization.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {'Member management is coming in a future sprint.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
