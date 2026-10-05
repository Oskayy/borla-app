'use client'

import { useClientValue } from '@/lib/use-client-value'

// Shown on the landing page right after a customer deletes their account (?account=deleted).
export default function DeletedNotice() {
  const deleted = useClientValue(() => new URLSearchParams(window.location.search).get('account') === 'deleted', false)
  if (!deleted) return null
  return (
    <p role="status" className="bg-customer-wash px-4 py-3 text-center text-[15px] font-medium text-customer-deep">
      Your Trashit account has been deleted. Thank you for using Trashit.
    </p>
  )
}
