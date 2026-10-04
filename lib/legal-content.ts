import { LegalSection } from '@/components/LegalPage'

export const privacyPolicySections: LegalSection[] = [
  {
    heading: '1. Introduction',
    blocks: [
      { type: 'p', text: 'Trashit ("we", "our", "us") operates a waste collection platform connecting customers with waste collectors in Ghana. This Privacy Policy explains what personal data we collect, why we collect it, and how it is handled. [Company legal name, registration number, and registered address to be inserted here.]' },
    ],
  },
  {
    heading: '2. Information We Collect',
    blocks: [
      { type: 'bullets', items: [
        'Account information: name, email address, phone number, gender (optional)',
        'Identity verification: government ID or vehicle registration documents (drivers only)',
        'Location data: pickup address, GPS coordinates captured at booking and at pickup/disposal confirmation',
        'Photo evidence: images of waste placement and collection, which may include incidental location metadata',
        'Payment information: processed by our payment provider (Paystack); we do not store full card details',
        'Usage data: booking history, app interactions, device/browser information',
      ]},
    ],
  },
  {
    heading: '3. How We Use Information',
    blocks: [
      { type: 'bullets', items: [
        'To create and manage accounts for customers and drivers',
        'To process bookings, payments, and driver payouts',
        'To verify pickup/disposal locations and driver identity',
        'To improve routing, pricing, and platform reliability',
        'To communicate service updates, receipts, and support responses',
        'To comply with legal and regulatory obligations',
      ]},
    ],
  },
  {
    heading: '4. Legal Basis for Processing',
    blocks: [
      { type: 'p', text: "[To be completed with reference to Ghana's Data Protection Act, 2012 (Act 843), including consent, contractual necessity, and legitimate interest bases as applicable to each category of data above.]" },
    ],
  },
  {
    heading: '5. Third Parties We Share Data With',
    blocks: [
      { type: 'bullets', items: [
        'Paystack — payment processing',
        'Mapbox — address geocoding and route optimization',
        'Supabase — authentication and data hosting infrastructure',
        '[Any future analytics, SMS, or notification providers to be added here]',
      ]},
    ],
  },
  {
    heading: '6. Data Retention',
    blocks: [
      { type: 'p', text: '[To be completed: how long account data, photo evidence, and location data are retained, and the process for deletion requests.]' },
    ],
  },
  {
    heading: '7. Your Rights',
    blocks: [
      { type: 'p', text: '[To be completed with data subject rights under Act 843 — access, correction, deletion, and objection to processing — and how to exercise them.]' },
    ],
  },
  {
    heading: '8. Data Security',
    blocks: [
      { type: 'p', text: 'We apply reasonable technical and organizational measures to protect personal data, including encrypted connections, access controls, and rate-limited authentication. [Further specifics to be added.]' },
    ],
  },
  {
    heading: "9. Children's Privacy",
    blocks: [
      { type: 'p', text: 'Trashit is not intended for use by individuals under [18] years old. [To be confirmed and expanded.]' },
    ],
  },
  {
    heading: '10. Changes to This Policy',
    blocks: [
      { type: 'p', text: 'We may update this policy from time to time. Material changes will be communicated via the app or by email. [To be finalized.]' },
    ],
  },
  {
    heading: '11. Contact Us',
    blocks: [
      { type: 'p', text: 'For privacy questions or data requests, contact: [support email / physical address to be inserted].' },
    ],
  },
]

export const termsSections: LegalSection[] = [
  {
    heading: '1. Acceptance of Terms',
    blocks: [
      { type: 'p', text: 'By creating an account or using Trashit ("the Platform"), you agree to these Terms & Conditions. If you do not agree, please do not use the Platform. [Company legal name and registration details to be inserted.]' },
    ],
  },
  {
    heading: '2. Description of Service',
    blocks: [
      { type: 'p', text: "Trashit connects customers who need waste collected with independent drivers who provide pickup and disposal services within Ghana's designated night-shift collection hours. [Insert specific service hours, coverage areas, and any licensing details.]" },
    ],
  },
  {
    heading: '3. Eligibility',
    blocks: [
      { type: 'bullets', items: [
        'Users must be at least [18] years old',
        'Drivers must complete identity verification (ID/license and vehicle registration) before accepting jobs',
        '[Any additional eligibility requirements to be added]',
      ]},
    ],
  },
  {
    heading: '4. Customer Responsibilities',
    blocks: [
      { type: 'bullets', items: [
        'Provide an accurate pickup address and/or location pin',
        'Ensure waste is accessible and safely presented for pickup',
        'Pay the quoted price at time of booking',
        '[Additional responsibilities to be added]',
      ]},
    ],
  },
  {
    heading: '5. Driver Responsibilities',
    blocks: [
      { type: 'bullets', items: [
        'Maintain a valid, verified vehicle registration and identification',
        'Complete assigned pickups and disposals honestly, with accurate photo/location evidence',
        'Report issues (e.g. inaccessible pickup, hazards) through the app rather than leaving orders unresolved',
        '[Additional responsibilities to be added]',
      ]},
    ],
  },
  {
    heading: '6. Pricing and Payment',
    blocks: [
      { type: 'p', text: 'Prices are calculated based on bin size, quantity, zone, and waste type at the time of booking, as shown before payment is confirmed. Payments are processed via Paystack. [Insert details on price changes, taxes, and currency.]' },
    ],
  },
  {
    heading: '7. Driver Payouts',
    blocks: [
      { type: 'p', text: 'Drivers are paid a percentage of the order value upon verified pickup and a further percentage upon verified disposal, according to the payout rule active at the time of assignment. [Insert payment schedule and method details.]' },
    ],
  },
  {
    heading: '8. Cancellations',
    blocks: [
      { type: 'p', text: '[To be completed: cancellation windows, applicable fees, and process.]' },
    ],
  },
  {
    heading: '9. Prohibited Conduct',
    blocks: [
      { type: 'bullets', items: [
        'Providing false address, identity, or waste information',
        "Attempting to circumvent the Platform's payment or verification systems",
        'Abusive or unsafe conduct toward drivers, customers, or staff',
        '[Additional prohibited conduct to be added]',
      ]},
    ],
  },
  {
    heading: '10. Limitation of Liability',
    blocks: [
      { type: 'p', text: '[To be completed with jurisdiction-appropriate limitation-of-liability language, covering service interruptions, third-party provider outages, and property/damage claims.]' },
    ],
  },
  {
    heading: '11. Dispute Resolution',
    blocks: [
      { type: 'p', text: "[To be completed: internal dispute process via the app's exception-reporting system, followed by applicable Ghanaian legal remedies if unresolved.]" },
    ],
  },
  {
    heading: '12. Governing Law',
    blocks: [
      { type: 'p', text: 'These Terms are governed by the laws of the Republic of Ghana. [To be confirmed by legal counsel.]' },
    ],
  },
  {
    heading: '13. Changes to These Terms',
    blocks: [
      { type: 'p', text: '[To be completed: notice process for material changes.]' },
    ],
  },
  {
    heading: '14. Contact Us',
    blocks: [
      { type: 'p', text: 'For questions about these Terms, contact: [support email / physical address to be inserted].' },
    ],
  },
]

export const cookiePolicySections: LegalSection[] = [
  {
    heading: '1. What Are Cookies',
    blocks: [
      { type: 'p', text: 'Cookies are small text files stored on your device that help websites and apps function correctly and remember information between visits.' },
    ],
  },
  {
    heading: '2. Cookies We Use',
    blocks: [
      { type: 'h2', text: 'Strictly Necessary' },
      { type: 'bullets', items: [
        'Session/authentication cookies (via Supabase Auth) — required to keep you logged in and to secure your session',
      ]},
      { type: 'h2', text: 'Functional' },
      { type: 'bullets', items: [
        '[Any preference-related cookies to be listed, e.g. saved filters or drafts, once built]',
      ]},
      { type: 'h2', text: 'Analytics' },
      { type: 'bullets', items: [
        '[To be completed once an analytics provider, e.g. Google Analytics, is selected — list what it tracks]',
      ]},
      { type: 'h2', text: 'Third-Party' },
      { type: 'bullets', items: [
        'Paystack — payment session cookies during checkout',
        'Mapbox — may set cookies related to map/geocoding functionality',
        '[Additional third-party cookies to be listed as integrated]',
      ]},
    ],
  },
  {
    heading: '3. Do We Need Your Consent?',
    blocks: [
      { type: 'p', text: 'Strictly necessary cookies (such as login sessions) do not require consent, as the Platform cannot function without them. Any analytics or non-essential cookies will only be set after you provide consent via the cookie banner. [To be confirmed against applicable law — Ghana does not currently have a dedicated cookie-consent statute, but this approach follows common international best practice given third-party providers involved.]' },
    ],
  },
  {
    heading: '4. Managing Cookies',
    blocks: [
      { type: 'p', text: 'You can control or delete cookies through your browser settings. Disabling strictly necessary cookies may prevent you from logging in or using core features of the Platform.' },
    ],
  },
  {
    heading: '5. Changes to This Policy',
    blocks: [
      { type: 'p', text: '[To be completed: notice process for changes.]' },
    ],
  },
  {
    heading: '6. Contact Us',
    blocks: [
      { type: 'p', text: 'For questions about our use of cookies, contact: [support email to be inserted].' },
    ],
  },
]

export const refundPolicySections: LegalSection[] = [
  {
    heading: '1. Overview',
    blocks: [
      { type: 'p', text: "This Refund Policy explains when and how customers may be entitled to a refund for payments made through Trashit. [To be reviewed against Ghana's consumer protection framework.]" },
    ],
  },
  {
    heading: '2. Eligible Situations',
    blocks: [
      { type: 'bullets', items: [
        "Pickup was not completed and marked FAILED_PICKUP due to circumstances outside the customer's control",
        'A duplicate or erroneous charge occurred due to a technical error',
        'Order was cancelled before a driver was assigned [insert applicable cancellation window]',
        '[Additional eligible situations to be added]',
      ]},
    ],
  },
  {
    heading: '3. Non-Eligible Situations',
    blocks: [
      { type: 'bullets', items: [
        'Pickup failed due to inaccessible waste, locked gates, or inaccurate customer-provided address (see Terms & Conditions, Customer Responsibilities)',
        'Customer simply changes their mind after a driver has been assigned and is en route',
        '[Additional non-eligible situations to be added]',
      ]},
    ],
  },
  {
    heading: '4. How to Request a Refund',
    blocks: [
      { type: 'p', text: "[To be completed: process for submitting a refund request — e.g. via the app's support/help section, expected response time, required information.]" },
    ],
  },
  {
    heading: '5. Refund Method and Timeline',
    blocks: [
      { type: 'p', text: 'Approved refunds will be issued to the original payment method via Paystack. [Insert expected processing time, e.g. 5–10 business days.]' },
    ],
  },
  {
    heading: '6. Disputed Orders',
    blocks: [
      { type: 'p', text: '[To be completed with review timeline and escalation process.]' },
    ],
  },
  {
    heading: '7. Changes to This Policy',
    blocks: [
      { type: 'p', text: '[To be completed: notice process for changes.]' },
    ],
  },
  {
    heading: '8. Contact Us',
    blocks: [
      { type: 'p', text: 'For refund requests or questions, contact: [support email to be inserted].' },
    ],
  },
]