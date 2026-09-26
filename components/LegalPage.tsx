export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'h2'; text: string }

export interface LegalSection {
  heading: string
  blocks: LegalBlock[]
}

export default function LegalPage({
  title,
  lastUpdated,
  sections,
}: {
  title: string
  lastUpdated: string
  sections: LegalSection[]
}) {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px 60px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{title}</h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>Last updated: {lastUpdated}</p>

      <div className="panel" style={{ background: '#FDECEA', borderColor: '#B3261E', marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: '#B3261E', fontWeight: 600, margin: 0 }}>
          Placeholder draft — not legal advice. This document is a generic starting template
          pending final review. It will be updated once the finalized version is provided.
        </p>
      </div>

      {sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 19, color: '#0F3D3E', marginBottom: 10 }}>{section.heading}</h2>
          {section.blocks.map((block, j) => {
            if (block.type === 'p') {
              return (
                <p key={j} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10, color: '#333' }}>
                  {block.text}
                </p>
              )
            }
            if (block.type === 'h2') {
              return (
                <h3 key={j} style={{ fontSize: 15, color: '#0F3D3E', margin: '12px 0 6px' }}>
                  {block.text}
                </h3>
              )
            }
            return (
              <ul key={j} style={{ margin: '0 0 10px', paddingLeft: 20 }}>
                {block.items.map((item, k) => (
                  <li key={k} style={{ fontSize: 14, lineHeight: 1.6, color: '#333', marginBottom: 4 }}>
                    {item}
                  </li>
                ))}
              </ul>
            )
          })}
        </div>
      ))}
    </div>
  )
}