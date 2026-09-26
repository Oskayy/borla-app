import LegalPage from '@/components/LegalPage'
import { cookiePolicySections } from '@/lib/legal-content'

export default function CookiePolicyPage() {
  return <LegalPage title="Cookie Policy" lastUpdated="[DATE]" sections={cookiePolicySections} />
}