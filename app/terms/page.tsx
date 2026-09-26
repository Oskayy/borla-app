import LegalPage from '@/components/LegalPage'
import { termsSections } from '@/lib/legal-content'

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" lastUpdated="[DATE]" sections={termsSections} />
}