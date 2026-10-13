import LegalPage from '@/components/LegalPage'
import { cookiePolicySections } from '@/lib/legal-content'

export default function CookiePolicyPage() {
  return <LegalPage title="Cookie Policy" lastUpdated="13 October 2026" sections={cookiePolicySections} />
}