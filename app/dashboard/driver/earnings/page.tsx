import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getEarningsHistory, getWalletSummary } from '@/lib/wallet-server'
import { MIN_WITHDRAWAL_GHS } from '@/lib/wallet'
import { MOMO_PROVIDERS } from '@/lib/phone'
import PayoutAccountForm from '@/components/PayoutAccountForm'
import WithdrawForm from '@/components/WithdrawForm'

export const dynamic = 'force-dynamic'

const WITHDRAWAL_LABELS: Record<string, { text: string; color: string }> = {
  REQUESTED: { text: 'Waiting for approval', color: '#9A6415' },
  PROCESSING: { text: 'Being sent', color: '#9A6415' },
  PAID: { text: 'Sent', color: '#2F7A4D' },
  FAILED: { text: 'Failed, money returned to balance', color: '#B3261E' },
  REJECTED: { text: 'Not approved, money returned to balance', color: '#B3261E' },
}

export default async function DriverEarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    select: { momoNumber: true, momoProvider: true, momoName: true, approvalStatus: true },
  })
  if (!profile) redirect('/dashboard/driver/profile-setup')

  const [wallet, history, withdrawals] = await Promise.all([
    getWalletSummary(user.id),
    getEarningsHistory(user.id),
    prisma.withdrawal.findMany({ where: { driverId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
  ])
  const hasOpen = withdrawals.some((w: { status: string }) => w.status === 'REQUESTED' || w.status === 'PROCESSING')
  const providerName = MOMO_PROVIDERS.find((p) => p.code === profile.momoProvider)?.name ?? profile.momoProvider

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>My Earnings</h1>

      <div className="panel" style={{ background: 'var(--color-primary)', border: 'none', color: 'white', marginBottom: 16 }}>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Available to withdraw</p>
        <p style={{ fontSize: 30, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>GHS {wallet.available.toFixed(2)}</p>
        <p style={{ fontSize: 12, opacity: 0.8 }}>
          Earned GHS {wallet.earned.toFixed(2)} · sent GHS {wallet.paidOut.toFixed(2)}
          {wallet.pending > 0 && ` · GHS ${wallet.pending.toFixed(2)} on its way`}
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Withdraw to mobile money</h2>
        {profile.approvalStatus !== 'APPROVED' ? (
          <p style={{ fontSize: 13, color: '#666' }}>You can withdraw once your account is approved.</p>
        ) : !profile.momoNumber ? (
          <p style={{ fontSize: 13, color: '#666' }}>Add your MoMo wallet below first.</p>
        ) : hasOpen ? (
          <p style={{ fontSize: 13, color: '#666' }}>You have a withdrawal in progress. You can ask for another once it&apos;s finished.</p>
        ) : wallet.available < MIN_WITHDRAWAL_GHS ? (
          <p style={{ fontSize: 13, color: '#666' }}>The smallest withdrawal is GHS {MIN_WITHDRAWAL_GHS}. Keep collecting!</p>
        ) : (
          <WithdrawForm available={wallet.available} walletLabel={`${providerName} ${profile.momoNumber}`} />
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>My MoMo wallet</h2>
        <PayoutAccountForm
          initial={{ momoNumber: profile.momoNumber ?? '', momoProvider: profile.momoProvider ?? 'MTN', momoName: profile.momoName ?? '' }}
          providers={MOMO_PROVIDERS}
          locked={hasOpen}
        />
      </div>

      <h2 style={{ fontSize: 16, margin: '8px 0' }}>Withdrawals</h2>
      {withdrawals.length === 0 && <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>None yet.</p>}
      {withdrawals.map((w: any) => (
        <div key={w.id} className="panel" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ fontWeight: 600 }}>GHS {w.amount.toFixed(2)}</p>
            <p style={{ fontSize: 12, color: '#666' }}>
              {new Date(w.requestedAt).toLocaleDateString()} · {w.momoProvider} {w.momoNumber}
              {w.note && (w.status === 'REJECTED' || w.status === 'FAILED') && ` · ${w.note}`}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: WITHDRAWAL_LABELS[w.status]?.color ?? '#666', textAlign: 'right' }}>
            {WITHDRAWAL_LABELS[w.status]?.text ?? w.status}
          </span>
        </div>
      ))}

      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Recent earnings</h2>
      {history.length === 0 && <p style={{ fontSize: 13, color: '#666' }}>No earnings yet.</p>}
      {history.map((e: any) => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <p style={{ fontSize: 14 }}>{(e.order?.quoteSnapshot as { address?: string } | null)?.address ?? 'Order'}</p>
            <p style={{ fontSize: 12, color: '#666' }}>
              {e.type === 'driver_payout_pickup' ? 'Pickup share' : 'Unload share'} · {new Date(e.createdAt).toLocaleString()}
            </p>
          </div>
          <p style={{ fontWeight: 600, color: '#2F7A4D', whiteSpace: 'nowrap' }}>+ GHS {e.amount.toFixed(2)}</p>
        </div>
      ))}
    </div>
  )
}
