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
      { type: 'p', text: 'By creating an account or using Trashit ("the Platform"), you agree to these Terms & Conditions. If you do not agree, please do not use the Platform.' },
      { type: 'p', text: "These Terms are an agreement between you and Trashit. [Registered company name, registration number and registered address: to be added once the company is registered.] Our Privacy Policy, Refund Policy and Cookie Policy are part of these Terms." },
    ],
  },
  {
    heading: '2. Description of Service',
    blocks: [
      { type: 'p', text: "Trashit connects customers who need household or business waste collected with independent drivers who collect it at night and take it to an approved disposal site." },
      { type: 'bullets', items: [
        "Collection happens overnight, during the hours shown in the app (currently 8pm to 6am, Ghana time). Bookings made before the cut-off shown in the app can be collected the same night; later ones are collected the next night.",
        "We only collect in the zones shown in the app. Your pickup pin must be inside one of them.",
        "We accept general and recyclable waste. Hazardous waste is only accepted when the app offers it as an option.",
        "If a pickup cannot be done on its night (for example bad weather or too many bookings), it moves to the next night automatically. You can cancel for a full refund until that night’s collection starts.",
      ]},
    ],
  },
  {
    heading: '3. Eligibility',
    blocks: [
      { type: 'bullets', items: [
        'Customers must be at least 16 years old; customers aged 16 or 17 need the permission of a parent or guardian',
        'Drivers must be at least 18 years old',
        "Drivers must give their Ghana Card number and vehicle plate number, add a photo of themselves and of their vehicle, and be approved by Trashit before they receive stops",
        "Drivers must hold any licence, permit and insurance the law requires for their vehicle and for carrying waste",
      ]},
      { type: 'p', text: "Drivers are independent contractors, not employees of Trashit. They choose when to go online, use their own vehicle and equipment, and are paid per stop as described in section 7. Nothing in these Terms creates employment, partnership or agency between a driver and Trashit. Drivers are responsible for their own taxes, except any tax the law requires Trashit to withhold from their pay." },
      { type: 'bullets', items: [
        'Trashit may refuse, pause or end a driver account for safety, fraud, repeated complaints or breaking these Terms, and will say why',
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
        "Put the waste out on the night of collection, in the bins or bags you booked, at the pin you dropped",
        "Tell us the truth about the waste: do not hide hazardous waste (chemicals, batteries, medical waste or sharps, asbestos, fuel) in an ordinary booking",
        "Never put out explosives, weapons, ammunition, or human or animal remains",
        "Keep your phone number up to date so your driver can reach you",
        "Treat drivers with respect",
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
        "Accept or decline each stop within the time shown in the app; a stop not accepted in time goes to another driver",
        "Take every load to an approved disposal site and confirm the unload in the app; never dump waste anywhere else",
        "Drive safely and obey traffic and environmental laws",
        "Use customers' details only to complete their pickups, and never contact them for anything else",
        "Never ask a customer for extra payment",
      ]},
    ],
  },
  {
    heading: '6. Pricing and Payment',
    blocks: [
      { type: 'bullets', items: [
        "The price depends on the size and number of bins, the zone and the type of waste. It is worked out by Trashit and shown, with any taxes, before you pay. The total shown is what you pay.",
        "All prices are in Ghana cedis (GHS). You pay in the app by card or mobile money through Paystack. Trashit never sees your full card details.",
        "Once you have paid, the price of that booking does not change. We may change prices for new bookings at any time.",
        "A pickup is only booked once payment is confirmed.",
      ]},
    ],
  },
  {
    heading: '7. Driver Payouts',
    blocks: [
      { type: 'bullets', items: [
        "For each stop, a driver earns a share of the price after Trashit's fee: part for the pickup and the rest once the unload at a disposal site is confirmed. The split is fixed when the customer pays and shown in the app.",
        "Earnings become available to withdraw 24 hours after the later of the unload and the end of that night's shift, unless a complaint or refund about that order is still open. New drivers have a small part kept back for their first 30 days.",
        "Available earnings are paid to the driver’s mobile money wallet each morning. Drivers can also cash out sooner from the app; the first cash-out each day is free and later ones the same day cost a small fee shown before you confirm.",
        "If a refund is given because a driver was at fault, that driver’s pay for the order is taken back from their earnings. If a pickup fails because of the customer, the driver receives part of any attempt fee.",
        "The amounts, times and limits in this section can change; the app always shows the current ones. Changes do not affect stops already paid for.",
      ]},
    ],
  },
  {
    heading: '8. Cancellations',
    blocks: [
      { type: 'bullets', items: [
        "You can cancel a paid booking in the app at no cost until collection starts on its night (8pm). You get a full refund to the card or wallet you paid with.",
        "After collection has started, the booking can no longer be cancelled in the app. Contact us, and any refund follows the Refund Policy.",
        "If a driver arrives and cannot collect because of something on your side (for example the waste is not out, the gate is locked or the pin is wrong), we may keep an attempt fee of up to 25% of the price and refund the rest.",
        "If we cannot collect because of something on our side, you get a full refund or a free pickup on another night, whichever you choose.",
        "Unpaid bookings can be deleted at any time.",
      ]},
    ],
  },
  {
    heading: '9. Prohibited Conduct',
    blocks: [
      { type: 'bullets', items: [
        'Providing false address, identity, or waste information',
        "Attempting to circumvent the Platform's payment or verification systems",
        'Abusive or unsafe conduct toward drivers, customers, or staff',
        "Paying, or asking to be paid, outside the app for a Trashit booking",
        "Using someone else’s account, Ghana Card number or payment method, or letting someone else use yours",
        "Faking pickup or unload photos or locations, or reusing photos",
        "Trying to break into, overload or copy the Platform",
      ]},
      { type: 'p', text: "We may suspend or close an account that breaks these rules. If money was taken unfairly, we may hold it back while we look into it." },
    ],
  },
  {
    heading: '10. Limitation of Liability',
    blocks: [
      { type: 'bullets', items: [
        "We work to collect every booking on its night, but we do not promise the service will always be available or on time. Delays caused by weather, traffic, closed disposal sites, power or network failures, or the payment, map and hosting services we rely on are outside our control.",
        "For any one order, Trashit's total liability to a customer is limited to the amount paid for that order, and to a driver to the pay for that stop.",
        "We are not liable for loss of profit, or for indirect loss that could not reasonably have been expected.",
        "Drivers are responsible for loss or damage they cause while collecting or carrying waste, as far as the law allows.",
        "Nothing in these Terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law of Ghana does not allow to be limited.",
      ]},
    ],
  },
  {
    heading: '11. Dispute Resolution',
    blocks: [
      { type: 'bullets', items: [
        "If something goes wrong, contact us first (section 14), with your order number. Drivers can also report a problem with a stop in the app. We will reply within 14 days and try to put it right.",
        "If we cannot agree, either side may ask for mediation under the Alternative Dispute Resolution Act, 2010 (Act 798). Each side pays its own costs and shares the mediator’s fee equally.",
        "If mediation does not settle it within 60 days, either side may take the dispute to the courts of Ghana.",
        "This does not stop you from going to court or to any regulator at any time if the law gives you that right.",
      ]},
    ],
  },
  {
    heading: '12. Governing Law',
    blocks: [
      { type: 'p', text: "These Terms are governed by the laws of the Republic of Ghana, and the courts of Ghana deal with any dispute that is not settled under section 11. If any part of these Terms cannot be enforced, the rest still applies." },
    ],
  },
  {
    heading: '13. Changes to These Terms',
    blocks: [
      { type: 'p', text: "We may change these Terms when the service or the law changes. If a change matters, we will tell you in the app (and by email if we have it) at least 14 days before it takes effect, unless the law or safety needs it sooner. If you keep using Trashit after that, you accept the new Terms; if you do not agree, you can delete your account. Changes never affect bookings already paid for." },
    ],
  },
  {
    heading: '14. Contact Us',
    blocks: [
      { type: 'p', text: "For questions about these Terms, contact Trashit at: [support email and phone: to be added before launch]." },
    ],
  },
]

export const cookiePolicySections: LegalSection[] = [
  {
    heading: "1. What Are Cookies",
    blocks: [
      { type: 'p', text: "Cookies are small text files stored on your device that help websites and apps work and remember information between visits. Browsers can also keep small amounts of information in their own storage on your device (called local storage). This policy covers both." },
    ],
  },
  {
    heading: "2. What We Use",
    blocks: [
      { type: 'h2', text: "Strictly necessary" },
      { type: 'bullets', items: [
        "Sign-in cookies from Supabase, our sign-in provider: they keep you signed in and protect your session. They are removed when you sign out or when they expire.",
        "Your cookie choice: remembers whether you chose \"Essential only\" or \"Accept all\", so we don’t ask again.",
        "If you turn on alerts, your browser keeps a small background helper (a service worker) so alerts can reach you when the app is closed.",
      ]},
      { type: 'h2', text: "Functional" },
      { type: 'p', text: "These only remember choices you make, and stay on your device. We don’t use them to follow you." },
      { type: 'bullets', items: [
        "Light or dark theme (trashit-theme).",
        "A pickup you priced before signing in (trashit-booking-draft): the address, pin and bins, so they aren’t lost while you create an account. It is ignored after 24 hours and removed once you book.",
        "That you closed the \"install the app\" suggestion (trashit-install-dismissed).",
        "Drivers only: short confirmation messages after an action (trashit-flash), cleared when the tab is closed.",
      ]},
      { type: 'h2', text: "Analytics and advertising" },
      { type: 'p', text: "We don’t use analytics or advertising cookies, and we don’t track you across other websites. If we add analytics in the future, we will list it here first and only use it if you choose \"Accept all\"." },
      { type: 'h2', text: "Third parties" },
      { type: 'bullets', items: [
        "Paystack: when you pay, you go to Paystack’s secure checkout page, which uses its own cookies under Paystack’s privacy policy.",
        "Mapbox: our maps are loaded from Mapbox, which may keep a small anonymous identifier in your browser to count how often maps are used.",
        "Google Maps: only when a driver opens directions; Google’s own policy applies there.",
      ]},
    ],
  },
  {
    heading: "3. Do We Need Your Consent?",
    blocks: [
      { type: 'p', text: "Strictly necessary cookies and storage don’t need your consent, because Trashit cannot work without them. Functional storage only remembers choices you make yourself, on your own device. We would only use analytics or other non-essential cookies if you choose \"Accept all\" in the cookie banner. Ghana has no law just for cookies; we follow the Data Protection Act, 2012 (Act 843) and our Privacy Policy." },
    ],
  },
  {
    heading: "4. Managing Cookies",
    blocks: [
      { type: 'p', text: "You can see, block or delete cookies and site storage in your browser settings. If you block strictly necessary cookies, you won’t be able to sign in. Deleting site storage resets your theme and cookie choice, and removes a priced pickup you haven’t booked yet. To change your cookie choice, clear this site’s data in your browser; the banner then appears again." },
    ],
  },
  {
    heading: "5. Changes to This Policy",
    blocks: [
      { type: 'p', text: "If we start using a new kind of cookie, we will update this policy before we do and, for anything non-essential, ask you first. The date at the top shows when it last changed." },
    ],
  },
  {
    heading: "6. Contact Us",
    blocks: [
      { type: 'p', text: "For questions about our use of cookies, contact Trashit at: [support email and phone: to be added before launch]." },
    ],
  },
]

export const refundPolicySections: LegalSection[] = [
  {
    heading: '1. Overview',
    blocks: [
      { type: 'p', text: "This Refund Policy explains when and how customers may be entitled to a refund for payments made through Trashit. It does not take away any right you have under the law of Ghana." },
    ],
  },
  {
    heading: '2. Eligible Situations',
    blocks: [
      { type: 'bullets', items: [
        "You cancel a paid booking in the app before collection starts on its night (8pm). The refund starts straight away; you do not need to ask.",
        "We could not collect because of something on our side (for example no driver was available, a vehicle broke down or the disposal site was closed). Your pickup moves to the next night at no cost, or, if you prefer, you get a full refund.",
        "The pickup was marked as collected but your waste was left behind, or the driver did not follow our rules. The driver's pay for that order is taken back.",
        "You were charged twice, or charged by mistake. These are refunded whenever you tell us, even after 7 days.",
        "Part of your booking was not collected. You get back the share of the price for what was left.",
      ]},
    ],
  },
  {
    heading: '3. Non-Eligible Situations',
    blocks: [
      { type: 'bullets', items: [
        "The pickup could not be done because of something on your side: the waste was not out, the gate was locked, the pin was wrong, or the waste was not what you booked (for example hidden hazardous waste). We may keep an attempt fee of up to 25% of the price, and we refund the rest. We never keep more than that.",
        "You change your mind after collection has started on the night, but the driver has not yet arrived. We treat this the same way: up to 25% kept, the rest refunded.",
        "Your waste was collected as booked. There is nothing to refund.",
        "You ask more than 7 days after the collection night (except for double or mistaken charges).",
      ]},
      { type: 'p', text: "Trashit pays the payment provider’s charges itself: you get back the full amount you paid, less any attempt fee." },
    ],
  },
  {
    heading: '4. How to Request a Refund',
    blocks: [
      { type: 'bullets', items: [
        "To cancel before collection starts, open the booking in the app and tap “Cancel this pickup”. Nothing else is needed.",
        "For anything else, contact us (section 8) within 7 days of the collection night. Tell us your order number, what went wrong and, if you can, add a photo.",
        "We reply within 2 working days: we approve the refund, ask for more details, or explain why we cannot refund. Refunds of GHS 100 or more are checked by a second member of the team, within the same time.",
      ]},
    ],
  },
  {
    heading: '5. Refund Method and Timeline',
    blocks: [
      { type: 'bullets', items: [
        "Refunds go back to the card or mobile money wallet you paid with, through Paystack. We start them as soon as they are approved.",
        "Mobile money refunds usually arrive within a few days. Card refunds can take up to 10 working days to show, depending on your bank.",
        "You get an alert in the app when a refund is started. If a refund does not go through, we fix it and let you know; you do not need to ask again.",
      ]},
    ],
  },
  {
    heading: '6. Disputed Orders',
    blocks: [
      { type: 'p', text: "If you disagree with our decision, reply and say why. A different member of the Trashit team looks at it again and answers within 5 working days. If you still disagree, you can use the steps in section 11 of the Terms & Conditions (mediation, then the courts of Ghana)." },
    ],
  },
  {
    heading: '7. Changes to This Policy',
    blocks: [
      { type: 'p', text: "We may change this policy. If a change matters, we will tell you in the app (and by email if we have it) before it takes effect. A booking is always handled under the policy that applied when you paid for it." },
    ],
  },
  {
    heading: '8. Contact Us',
    blocks: [
      { type: 'p', text: "For refund requests or questions, contact Trashit at: [support email and phone: to be added before launch]." },
    ],
  },
]