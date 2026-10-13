import LegalPage from '@/components/LegalPage'
import { privacyPolicySections } from '@/lib/legal-content'

export default function PrivacyPolicyPage() {
  return <LegalPage title="Privacy Policy" lastUpdated="13 October 2026" sections={privacyPolicySections} />
}