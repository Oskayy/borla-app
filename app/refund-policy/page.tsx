import LegalPage from '@/components/LegalPage'
import { refundPolicySections } from '@/lib/legal-content'

export default function RefundPolicyPage() {
  return <LegalPage title="Refund Policy" lastUpdated="13 October 2026" sections={refundPolicySections} />
}