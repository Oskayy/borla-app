import { LegalSection } from '@/components/LegalPage'

export const privacyPolicySections: LegalSection[] = [
  {
    heading: '1. Introduction',
    blocks: [
      { type: 'p', text: 'Trashit ("we", "our", "us") operates a waste collection platform connecting customers with waste collectors in Ghana. This Privacy Policy explains what personal data we collect, why we collect it, and how it is handled.' },
      { type: 'p', text: "Trashit is responsible for your personal data (the \"data controller\" under the Data Protection Act, 2012 (Act 843)). [Registered company name, registration number and registered address: to be added once the company is registered.]" },
    ],
  },
  {
    heading: '2. Information We Collect',
    blocks: [
      { type: 'bullets', items: [
        'Account information: name, email address, phone number and password (stored only in scrambled form)',
        "Driver details (drivers only): Ghana Card number, vehicle plate number, a photo of the driver and of the vehicle, a driver's licence photo if provided, home base, mobile money wallet for payouts, and the driver's location while online",
        'Location data: pickup address, GPS coordinates captured at booking and at pickup/disposal confirmation',
        'Photo evidence: images of waste placement and collection, which may include incidental location metadata',
        'Payment information: processed by our payment provider (Paystack); we do not store full card details',
        'Usage data: booking history, ratings and comments, and, if you turn on alerts, the push address your browser gives us',
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
      { type: 'p', text: "Under the Data Protection Act, 2012 (Act 843), we only use personal data when we have a lawful reason:" },
      { type: 'bullets', items: [
        "To provide the service you asked for (our contract with you): your account, bookings, pickup pins and photos, payments and refunds, and for drivers their stops, earnings and payouts.",
        "To meet our legal duties: keeping tax and accounting records, checking who our drivers are, and answering lawful requests from the authorities.",
        "For our legitimate interests, balanced against yours: spotting fraud and fake pickups (for example a photo far from the pin, or the same photo used twice), keeping accounts secure, settling complaints, and improving routes and prices. These checks flag things for a person to review; they never decide on their own.",
        "With your consent: alerts on your phone, and your device's location when you choose to share it. You can withdraw consent at any time in your browser or phone settings; this does not affect what was done before.",
      ]},
    ],
  },
  {
    heading: '5. Third Parties We Share Data With',
    blocks: [
      { type: 'bullets', items: [
        'Paystack: card and mobile money payments, refunds and driver payouts',
        'Supabase: sign-in, database and file storage',
        'Vercel: hosts the app',
        'Mapbox: maps and finding addresses',
        "Google Maps: when a driver taps Navigate, the customer's pin is opened in Google Maps on the driver's phone",
        'Arkesel: text messages (SMS), once switched on',
        "Your browser's or phone's push service (for example Google or Apple): delivers alerts you turned on",
      ]},
      { type: 'p', text: "Each of them only gets the data needed for their part, and may not use it for anything else. Some of them store data outside Ghana: our database and files are kept in the European Union (Ireland). We only use providers that protect personal data to a standard at least as high as Ghanaian law requires. We do not sell personal data, and we do not use it for advertising." },
      { type: 'bullets', items: [
        "Within Trashit, staff see only what their job needs. Customers see their driver’s first name and type of vehicle. Drivers see, for their own stops only, the customer’s pin, address, waste photo and phone number (to call on arrival), but never the customer’s email. Ratings reach the driver without the customer’s name.",
      ]},
    ],
  },
  {
    heading: '6. Data Retention',
    blocks: [
      { type: 'p', text: 'We keep personal data only for as long as we need it to provide the service, settle complaints and refunds, and meet our legal duties, as the Data Protection Act, 2012 (Act 843) requires. After that it is deleted automatically.' },
      { type: 'bullets', items: [
        'Account details (name, phone number, email, home pin): while your account is open. They are removed as soon as you delete your account.',
        'Photos of waste placement, pickup and unloading, and the GPS position recorded with them: 12 months after the order is finished, then deleted. If a complaint or refund on that order is still open, they are kept until it is settled.',
        'The pin and address of each booking: 12 months after the order is finished, then removed from the order record.',
        "Drivers' live location: only the latest position is stored, and it is replaced as the driver moves. It is removed when the driver deletes their account.",
        "Drivers' identity, vehicle and payout details (Ghana Card number, vehicle plate, vehicle photos, documents, mobile money wallet): while the driver account is open. They are deleted when the account is deleted.",
        'In-app alerts: 90 days.',
        'Bookings that were never paid: 30 days.',
        'Orders, payments, refunds, driver earnings and payouts: 6 years, because tax and accounting law requires these records. If you delete your account, they are kept without your name, phone number, email, address or full wallet number.',
      ]},
      { type: 'p', text: 'You can delete your account yourself in the app (customers: Settings; drivers: Account, then Privacy and data) by typing DELETE and entering your password. A pickup in progress has to finish (or be cancelled) first. Drivers first need to finish any stops on their list and cash out their earnings, and any amount owed to Trashit has to be settled. You can also ask us to delete your data using the contact details in section 11; we will respond within 30 days.' },
    ],
  },
  {
    heading: '7. Your Rights',
    blocks: [
      { type: 'p', text: "Under the Data Protection Act, 2012 (Act 843), you have the right to:" },
      { type: 'bullets', items: [
        "Know what personal data we hold about you and get a copy. Customers can download their data in the app (Settings, Download my data); drivers can ask us.",
        "Have wrong or out-of-date data corrected. You can change most details yourself in the app.",
        "Have your data deleted, by deleting your account in the app or asking us (see section 6 for what we must keep for tax).",
        "Object to us using your data for our legitimate interests, or ask us to stop.",
        "Withdraw your consent to alerts or location sharing at any time.",
        "Complain to the Data Protection Commission of Ghana if you think we have mishandled your data.",
      ]},
      { type: 'p', text: "To use any of these rights, contact us (section 11). We may ask you to confirm who you are first. We will reply within 30 days and will not charge you." },
    ],
  },
  {
    heading: '8. Data Security',
    blocks: [
      { type: 'p', text: "We protect personal data with technical and organisational measures, including:" },
      { type: 'bullets', items: [
        'Encrypted connections (HTTPS) for everything the app sends and receives',
        'Passwords stored only in scrambled form; we can never see them',
        'Two-step sign-in (2FA) for all Trashit staff, and limits on repeated sign-in attempts',
        'Staff can only open what their role needs, and staff actions are logged',
        "Photos and drivers' documents kept in private storage, shown only through links that expire after 30 minutes",
        'Changing a payout wallet needs the password again; manual payouts and large refunds need a second person to approve',
      ]},
      { type: 'p', text: "No system is completely secure. If a breach puts your personal data at risk, we will tell you and the Data Protection Commission as soon as we reasonably can." },
    ],
  },
  {
    heading: "9. Children's Privacy",
    blocks: [
      { type: 'p', text: "You must be at least 16 to book pickups and at least 18 to drive with Trashit. If you are 16 or 17, you need the permission of a parent or guardian to use Trashit. We do not knowingly collect personal data from anyone younger; if we learn that we have, we will delete the account and its data." },
    ],
  },
  {
    heading: '10. Changes to This Policy',
    blocks: [
      { type: 'p', text: "We may update this policy when the service or the law changes. If we make an important change, we will tell you in the app (and by email if we have it) before it takes effect. The latest version is always on this page." },
    ],
  },
  {
    heading: '11. Contact Us',
    blocks: [
      { type: 'p', text: "For privacy questions or data requests, contact Trashit at: [privacy email and phone: to be added before launch]. You can also contact the Data Protection Commission of Ghana." },
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
        'Customers must be at least 16 years old; customers aged 16 or 17 need the permission of a parent or guardian',
        'Drivers must be at least 18 years old',
        "Drivers must give their Ghana Card number and vehicle plate number, add a photo of themselves and of their vehicle, and be approved by Trashit before they receive stops",
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