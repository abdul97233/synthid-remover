import { ArrowRight, Lock } from 'lucide-react'
import { navigate } from '../../lib/router'
import { GITHUB_URL } from '../../lib/constants'
import { Button } from '../ui/Button'
import { Reveal } from '../ui/Motion'
import { GithubIcon } from '../ui/GithubIcon'
import { CONTAINER } from './GlowCard'

export function CtaBand() {
  return (
    <section className="pb-20 lg:pb-28" aria-labelledby="cta-title">
      <div className={CONTAINER}>
        <Reveal>
          <div className="ring-gradient rounded-[28px] p-px">
            <div className="relative isolate overflow-hidden rounded-[27px] bg-card px-6 py-14 text-center sm:px-12 lg:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-full h-[420px] w-[min(820px,130%)] -translate-x-1/2 -translate-y-1/2 animate-aurora">
                  <div className="glow-blob inset-0 opacity-50" />
                </div>
              </div>
              <h2 id="cta-title" className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl">
                Ready to take a look inside your files?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-pretty text-muted">
                Free forever. No account. Open the workspace and drop in a file.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button size="lg" onClick={() => navigate('/app')} className="group">
                  Clean my files <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="glass inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-line px-6 text-[15px] font-medium transition-colors hover:border-line-strong"
                >
                  <GithubIcon className="size-4" /> View source
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
