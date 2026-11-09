import type { MouseEvent, ReactNode } from 'react'
import { ExternalLink, Lock } from 'lucide-react'
import { GithubIcon } from '../ui/GithubIcon'
import { APP_NAME, GITHUB_URL, SYNTHID_DETECTOR_URL, C2PA_VERIFY_URL } from '../../lib/constants'
import { Logo } from './Logo'
import { goToSection } from './nav'

const linkCls =
  'inline-flex items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-foreground'

function SectionAnchor({ id, children }: { id: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    goToSection(id)
  }
  return (
    <a href={`#${id}`} onClick={onClick} className={linkCls}>
      {children}
    </a>
  )
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={linkCls}>
      {children}
      <ExternalLink className="size-3 opacity-70" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{title}</p>
      <ul className="space-y-3">{children}</ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="relative border-t border-line/70 bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] lg:gap-8 lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            A free, privacy-first analyzer and metadata cleaner for images, audio and video. Everything
            runs locally in your browser.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-[1fr_1fr_1.2fr]">
          <Column title="Product">
            <li>
              <a href="#/app" className={linkCls}>Open the app</a>
            </li>
            <li><SectionAnchor id="features">Features</SectionAnchor></li>
            <li><SectionAnchor id="how-it-works">How it works</SectionAnchor></li>
            <li><SectionAnchor id="faq">FAQ</SectionAnchor></li>
          </Column>

          <Column title="Trust">
            <li><SectionAnchor id="honesty">About SynthID</SectionAnchor></li>
            <li><SectionAnchor id="privacy">Privacy</SectionAnchor></li>
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className={linkCls}>
                <GithubIcon className="size-3.5" /> Source code
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          </Column>

          <div className="col-span-2 sm:col-span-1">
            <Column title="Official verification">
              <li><External href={SYNTHID_DETECTOR_URL}>Google SynthID Detector</External></li>
              <li><External href={C2PA_VERIFY_URL}>Content Credentials Verify</External></li>
            </Column>
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              Third-party tools. This app never sends your file anywhere.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© 2026 {APP_NAME} · MIT License · No cookies, no analytics, no uploads.</p>
          <p>Not affiliated with Google. SynthID is a technology of Google DeepMind.</p>
        </div>
      </div>
    </footer>
  )
}
