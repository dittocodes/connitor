'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthSession } from '@/hooks/useAuthSession';

export default function VendorWalletPage(): React.ReactElement {
  const user = useAuthSession<{ distributorId?: string }>();
  const [balance, setBalance] = React.useState<number | null>(null);
  const [amount, setAmount] = React.useState('1000');

  const vendorId = user?.distributorId;

  const load = React.useCallback(() => {
    if (!vendorId) return;
    apiClient
      .get(`/api/delivery/wallets/${vendorId}`)
      .then((res) => setBalance(res.data.balance))
      .catch(() => setBalance(null));
  }, [vendorId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const recharge = async () => {
    if (!vendorId) return;
    await apiClient.post('/api/delivery/wallets/recharge', {
      vendorId,
      amount: Number(amount),
    });
    load();
  };

  return (
    <div className="p-6 space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Vendor Wallet</h1>
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-3xl font-semibold">₹{balance ?? '—'}</p>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="button" onClick={() => void recharge()}>
            Recharge
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
