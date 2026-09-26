import LegalPage from '@/components/LegalPage'
import { refundPolicySections } from '@/lib/legal-content'

export default function RefundPolicyPage() {
  return <LegalPage title="Refund Policy" lastUpdated="[DATE]" sections={refundPolicySections} />
}