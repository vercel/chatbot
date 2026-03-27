'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Demo', href: '#demo' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Contact', href: '#contact' },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo / Brand */}
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="font-source-serif text-sm font-bold text-primary-foreground">
                N
              </span>
            </div>
            <span className="font-source-serif text-lg font-semibold text-foreground">
              Form-Filling Assistant
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-inter text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Button asChild size="lg" className="rounded-lg">
              <Link href="/home">Launch App</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? (
              <XIcon className="size-6" />
            ) : (
              <MenuIcon className="size-6" />
            )}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="border-t border-border/40 bg-background px-4 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-inter text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <Button asChild size="lg" className="mt-2 w-full rounded-lg">
                <Link href="/home">Launch App</Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:justify-between">
            {/* Copy */}
            <div className="max-w-2xl text-center lg:text-left">
              <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
                Built by Nava Labs
              </p>
              <h1 className="mt-4 font-source-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Complete benefit applications{' '}
                <span className="text-primary">faster</span>, with AI
              </h1>
              <p className="mt-6 font-inter text-lg leading-relaxed text-muted-foreground sm:text-xl">
                A GenAI-powered tool that navigates multiple databases and
                benefit portals, then fills out applications for caseworkers to
                review, edit, and submit — so they can focus on the human
                element of client support.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="rounded-lg px-8 text-base">
                  <Link href="/home">Get Started</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-lg px-8 text-base"
                >
                  <a href="#demo">Watch Demo</a>
                </Button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative w-full max-w-md lg:max-w-lg">
              <div className="overflow-hidden rounded-[25px] bg-chat-background p-2">
                <Image
                  src="/illustration-cropped.png"
                  alt="Form-Filling Assistant illustration"
                  width={600}
                  height={450}
                  className="rounded-[20px] object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problem / Mission ─── */}
      <section className="bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              Why This Matters
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              $228 billion in unclaimed benefits
            </h2>
            <p className="mt-6 font-inter text-lg leading-relaxed text-muted-foreground">
              In 2022, American families left $228 billion in unclaimed benefits
              across 7 major programs. Current AI tools help identify
              eligibility, but struggle with the most labor-intensive task:
              actually completing applications across multiple benefit systems.
              The Form-Filling Assistant bridges that gap.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Key Features ─── */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              Key Features
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              Built for caseworkers, by public-interest technologists
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<BotIcon />}
              title="AI-Powered Form Filling"
              description="GenAI agents autonomously navigate portals and databases to complete applications using existing client data from your case management system."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Caseworker Oversight"
              description="Nothing is submitted automatically. You review every field, fill in any gaps, and submit only when everything looks right."
            />
            <FeatureCard
              icon={<LayersIcon />}
              title="Multi-Program Support"
              description="Supports multiple benefit programs simultaneously, reducing repetitive data entry across different systems."
            />
            <FeatureCard
              icon={<ClockIcon />}
              title="Save Hours Per Application"
              description="Dramatically cut down the time spent on manual data entry so you can focus on what matters — supporting your clients."
            />
            <FeatureCard
              icon={<UsersIcon />}
              title="Built with Caseworkers"
              description='Developed in partnership with Imagine LA and Riverside County, with direct feedback from the people who use it every day.'
            />
            <FeatureCard
              icon={<CodeIcon />}
              title="Open Source"
              description="Built in the open as part of Nava Labs. The code is available on GitHub for transparency and community collaboration."
            />
          </div>
        </div>
      </section>

      {/* ─── Demo Video ─── */}
      <section id="demo" className="scroll-mt-20 bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              See It in Action
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              Latest Demo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-inter text-lg text-muted-foreground">
              Watch how the Form-Filling Assistant helps caseworkers complete
              benefit applications in minutes instead of hours.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-4xl">
            <div className="relative overflow-hidden rounded-2xl bg-foreground/5 shadow-lg">
              {/*
                Replace the src below with your latest demo video URL.
                Supports YouTube embeds, Loom, or a direct .mp4 via <video>.
              */}
              <div className="aspect-video w-full">
                <div className="flex size-full items-center justify-center bg-foreground/5">
                  <div className="text-center">
                    <PlayIcon className="mx-auto size-16 text-primary/60" />
                    <p className="mt-4 font-inter text-sm text-muted-foreground">
                      Demo video coming soon
                    </p>
                    <p className="mt-1 font-inter text-xs text-muted-foreground/60">
                      Replace this placeholder with a YouTube embed or video URL
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              Simple Process
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              How It Works
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
            <StepCard
              step={1}
              title="Start and Autofill"
              description="AI autofills the application for you, using client data from your case management system."
            />
            <StepCard
              step={2}
              title="Fill in Any Gaps"
              description="You review and complete anything that's missing. The AI only adds what's already in your system."
            />
            <StepCard
              step={3}
              title="Submit with Confidence"
              description="You submit the application once everything looks right. Nothing is submitted automatically."
            />
          </div>
        </div>
      </section>

      {/* ─── Partnerships ─── */}
      <section className="bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              Our Partners
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              Developed with those who know the work best
            </h2>
            <p className="mt-6 font-inter text-lg leading-relaxed text-muted-foreground">
              Built by Nava Labs as part of Google.org&apos;s Gen AI cohort, in
              partnership with Imagine LA and Riverside County. We work directly
              with caseworkers to ensure the tool meets real-world needs.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Contact ─── */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-ibm-plex-mono text-xs font-medium uppercase tracking-widest text-primary">
              Get in Touch
            </p>
            <h2 className="mt-4 font-source-serif text-3xl font-bold sm:text-4xl">
              Let&apos;s talk about what we can build together
            </h2>
            <p className="mt-6 font-inter text-lg leading-relaxed text-muted-foreground">
              Whether you&apos;re a government agency, community organization,
              or just curious about how AI can improve benefits access — we&apos;d
              love to hear from you.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="rounded-lg px-8 text-base">
                <a href="mailto:labs@navapbc.com">Email Us</a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-lg px-8 text-base"
              >
                <a
                  href="https://www.navapbc.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact Nava
                </a>
              </Button>
            </div>
            <p className="mt-6 font-inter text-sm text-muted-foreground">
              Or email us directly at{' '}
              <a
                href="mailto:labs@navapbc.com"
                className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
              >
                labs@navapbc.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <span className="font-source-serif text-sm font-bold text-primary-foreground">
                  N
                </span>
              </div>
              <span className="font-source-serif text-lg font-semibold text-foreground">
                Form-Filling Assistant
              </span>
            </div>

            <p className="font-inter text-sm text-muted-foreground">
              Built by{' '}
              <a
                href="https://www.navapbc.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
              >
                Nava PBC
              </a>{' '}
              &middot; Open Source &middot; Public Interest Technology
            </p>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/navapbc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="GitHub"
              >
                <GithubIcon className="size-5" />
              </a>
              <a
                href="https://www.navapbc.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Nava website"
              >
                <GlobeIcon className="size-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background p-6 transition-shadow hover:shadow-md">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-source-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 font-inter text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-[25px] bg-muted p-6 text-center lg:p-8">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
        {step}
      </div>
      <h3 className="font-source-serif text-xl font-semibold">{title}</h3>
      <p className="mt-3 font-inter text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/* ─── Icons (inline SVGs to avoid extra dependencies) ─── */

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-6'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.732-3.558" />
    </svg>
  );
}
