import { CreditCard } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{'Billing'}</CardTitle>
        <CardDescription>{'Manage your plan and payment details.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CreditCard className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {'Billing and plan management is coming in a future sprint.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
