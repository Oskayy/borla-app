import { Info } from 'lucide-react'
import SiteHeader from '@/components/landing/SiteHeader'
import SiteFooter from '@/components/landing/SiteFooter'

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'h2'; text: string }

export interface LegalSection {
  heading: string
  blocks: LegalBlock[]
}

const slug = (i: number, heading: string) =>
  `${i + 1}-${heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}`

// The legal pages (privacy, terms, refunds, cookies), made for reading: the site header, a contents list that stays
// in view on a computer, and text at a comfortable line length.
export default function LegalPage({ title, lastUpdated, sections }: { title: string; lastUpdated: string; sections: LegalSection[] }) {
  return (
    <div data-surface="new" className="flex min-h-dvh flex-col bg-canvas text-ink">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="anim-rise max-w-3xl">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.04em]">{title}</h1>
          <p className="mt-3 text-sm text-ink-3">Last updated {lastUpdated}</p>
          <p className="mt-6 flex items-start gap-3 rounded-card bg-warn-wash p-4 text-sm font-medium text-ink ring-1 ring-warn/30">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-deep" />
            Draft awaiting legal review. The registered company details and contact information will be added before launch.
          </p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Contents" className="hidden lg:block">
            <div className="sticky top-28">
              <p className="text-sm font-semibold text-ink-3">Contents</p>
              <ol className="mt-3 grid gap-1 border-l border-line">
                {sections.map((s, i) => (
                  <li key={i}>
                    <a
                      href={`#${slug(i, s.heading)}`}
                      className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-ink-2 transition hover:border-action-deep hover:text-ink"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="anim-stagger grid max-w-[70ch] gap-10">
            {sections.map((section, i) => (
              <section key={i} id={slug(i, section.heading)} aria-labelledby={`h-${i}`} className="scroll-mt-28">
                <h2 id={`h-${i}`} className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold tracking-[-0.02em]">
                  {section.heading}
                </h2>
                <div className="mt-3 grid gap-3">
                  {section.blocks.map((block, j) => {
                    if (block.type === 'p') {
                      return (
                        <p key={j} className="text-[16px] leading-[1.7] text-ink-2">
                          {block.text}
                        </p>
                      )
                    }
                    if (block.type === 'h2') {
                      return (
                        <h3 key={j} className="mt-2 text-[17px] font-semibold">
                          {block.text}
                        </h3>
                      )
                    }
                    return (
                      <ul key={j} className="grid gap-2 pl-5 marker:text-action-deep [list-style:disc]">
                        {block.items.map((item, k) => (
                          <li key={k} className="pl-1 text-[16px] leading-[1.7] text-ink-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )
                  })}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
