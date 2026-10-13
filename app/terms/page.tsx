import LegalPage from '@/components/LegalPage'
import { termsSections } from '@/lib/legal-content'

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" lastUpdated="13 October 2026" sections={termsSections} />
}