// The one dark card per screen: what matters most right now (tonight's job, the active pickup, the plan).
// A slow glow in the platform's accent sits behind the content (still with reduced motion).
export default function HeroCard({
  children,
  className = '',
  glow = true,
  as: Tag = 'section',
  ...rest
}: {
  children: React.ReactNode
  className?: string
  glow?: boolean
  as?: 'section' | 'div' | 'article'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag {...rest} className={`${glow ? 'hero-glow' : ''} rounded-card bg-hero p-5 text-on-hero sm:p-6 ${className}`}>
      {children}
    </Tag>
  )
}
