import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Web Bot Disclosure - ASP Case Management',
  description: 'Technical and legal disclosure for the ASP Case Management web automation bot',
};

export default function BotDisclosure() {
  return (
    <div className="bg-background min-h-screen w-full">
      <div className="flex flex-col items-start justify-center py-8 px-4 sm:py-12 sm:px-6 md:py-16 md:px-8 lg:py-20 lg:px-12 xl:py-24 xl:px-16">
        <div className="w-full max-w-4xl mx-auto text-left">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold text-foreground mb-4 leading-[1.15] font-source-serif">
            Web Bot Disclosure and Verification
          </h1>

          <p className="text-sm sm:text-base md:text-lg lg:text-[18px] text-foreground mb-8 leading-normal font-inter">
            This page provides technical and legal disclosure regarding the ASP (Application Support Portal)
            Case Management web automation system operated by Nava Public Benefit Corporation.
          </p>

          {/* Section 1 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              1. Bot Operator Information
            </h2>
            <div className="space-y-2 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2">
                <dt className="font-semibold">Legal Entity:</dt>
                <dd>Nava Public Benefit Corporation</dd>
                <dt className="font-semibold">Jurisdiction:</dt>
                <dd>United States of America</dd>
                <dt className="font-semibold">Business Purpose:</dt>
                <dd>Public benefit technology services for government agencies</dd>
                <dt className="font-semibold">Contact Email:</dt>
                <dd>
                  Security/Technical: <a href="mailto:labs-asp@navapbc.com" className="underline hover:no-underline">labs-asp@navapbc.com</a>
                  <br />
                  General: <a href="mailto:labs@navapbc.com" className="underline hover:no-underline">labs@navapbc.com</a>
                </dd>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              2. Bot Technical Specifications
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              2.1 Identification
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>
                <span className="font-semibold">User-Agent String:</span>{' '}
                <code className="bg-muted px-2 py-1 rounded text-sm font-geist-mono">
                  Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 (Nava/1.0)
                </code>
              </li>
              <li>
                <span className="font-semibold">Verified Domains:</span>
                <ul className="list-disc ml-4 sm:ml-6 mt-2 space-y-1">
                  <li>Development: <code className="bg-muted px-2 py-1 rounded text-sm font-geist-mono">dev.labs-asp.navateam.com</code></li>
                  <li>Production: <code className="bg-muted px-2 py-1 rounded text-sm font-geist-mono">app.labs-asp.navateam.com</code></li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Verification Method:</span> HTTP Message Signatures (RFC 9421) using Ed25519 cryptographic keys
              </li>
              <li>
                <span className="font-semibold">Cloudflare Status:</span> Registered Verified Bot (Signed Agent)
              </li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              2.2 Public Key Infrastructure
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">
              All HTTP requests originating from this bot are cryptographically signed. Public keys for verification
              are accessible via the following endpoints:
            </p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>
                Development:{' '}
                <a
                  href="https://dev.labs-asp.navateam.com/.well-known/http-message-signatures-directory"
                  className="underline hover:no-underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://dev.labs-asp.navateam.com/.well-known/http-message-signatures-directory
                </a>
              </li>
              <li>
                Production:{' '}
                <a
                  href="https://app.labs-asp.navateam.com/.well-known/http-message-signatures-directory"
                  className="underline hover:no-underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://app.labs-asp.navateam.com/.well-known/http-message-signatures-directory
                </a>
              </li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              2.3 Technology Stack
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li><span className="font-semibold">Browser Engine:</span> Chromium via Playwright automation framework</li>
              <li><span className="font-semibold">AI Model:</span> Anthropic Claude Sonnet 4.5</li>
              <li><span className="font-semibold">Infrastructure:</span> Google Cloud Platform (Cloud Run, Compute Engine)</li>
              <li><span className="font-semibold">Runtime:</span> Node.js (TypeScript)</li>
              <li><span className="font-semibold">Framework:</span> Mastra.ai agent orchestration</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              3. Operational Parameters
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              3.1 Purpose and Scope
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              This bot is designed exclusively to assist social service caseworkers in navigating government benefit
              portals and information websites on behalf of families seeking public support services including, but
              not limited to, WIC (Women, Infants, and Children), SNAP (Supplemental Nutrition Assistance Program),
              and Medicaid.
            </p>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              3.2 Operational Model
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">
              The bot operates <span className="font-semibold">autonomously based on caseworker intent</span>. Authorized caseworkers provide
              high-level objectives through a secure web interface (e.g., &ldquo;research WIC eligibility requirements for
              California residents&rdquo;), and the AI-powered system autonomously:
            </p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-4 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Performs web searches using commercial search engines</li>
              <li>Navigates to relevant government and institutional websites</li>
              <li>Extracts and synthesizes information from web pages</li>
              <li>Populates application forms with participant data from secure databases</li>
              <li>Captures screenshots and documentation for case records</li>
            </ul>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              All bot activity is <span className="font-semibold">initiated and supervised by authenticated human caseworkers</span>. The system
              does not operate independently or crawl the web without explicit human direction.
            </p>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              3.3 Access Control
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Access restricted to authenticated caseworkers via secure login</li>
              <li>Role-based access control (RBAC) enforced</li>
              <li>All sessions logged and auditable</li>
              <li>Multi-factor authentication available for sensitive operations</li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              3.4 Rate Limiting and Resource Consumption
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li><span className="font-semibold">Maximum Concurrent Sessions:</span> 5 browser instances per environment</li>
              <li><span className="font-semibold">Request Timeout:</span> 3600 seconds (1 hour) maximum per workflow</li>
              <li><span className="font-semibold">Throttling:</span> Automatic delays implemented to prevent target site overload</li>
              <li><span className="font-semibold">Respect for robots.txt:</span> Standard web crawling conventions honored</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              4. Data Protection and Privacy
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              4.1 Data Handling
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Participant personally identifiable information (PII) stored in encrypted PostgreSQL databases</li>
              <li>Data transmission encrypted via TLS 1.3</li>
              <li>Compliance with HIPAA privacy and security rules where applicable</li>
              <li>Data retention policies aligned with government record-keeping requirements</li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              4.2 Security Measures
            </h3>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Application Default Credentials (ADC) for service authentication (no static API keys)</li>
              <li>Google Cloud Secret Manager for sensitive credential storage</li>
              <li>Network isolation via VPC and firewall rules</li>
              <li>Regular security audits and dependency updates</li>
              <li>Comprehensive audit logging of all bot actions</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              5. Responsible Crawling Practices
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              5.1 Website Interaction Policy
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">This bot commits to:</p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li><span className="font-semibold">Transparent identification:</span> Uses verified cryptographic signatures on all requests</li>
              <li><span className="font-semibold">Human-paced interaction:</span> Session timing mimics human behavior patterns</li>
              <li><span className="font-semibold">Respectful resource usage:</span> No aggressive scraping or automated mass downloads</li>
              <li><span className="font-semibold">Standards compliance:</span> Honors HTTP headers, robots.txt, and meta robots tags</li>
              <li><span className="font-semibold">Error handling:</span> Graceful degradation on access denial or rate limiting</li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              5.2 Prohibited Activities
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">This bot will NOT:</p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Attempt to circumvent access controls or authentication mechanisms</li>
              <li>Execute denial-of-service attacks or resource exhaustion techniques</li>
              <li>Harvest data for commercial purposes unrelated to case management</li>
              <li>Access non-public areas without explicit authorization</li>
              <li>Impersonate human users for fraudulent purposes</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              6. Cloudflare Pay Per Crawl Program
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">
              This bot participates in Cloudflare&apos;s <span className="font-semibold">Verified Bots</span> program and the{' '}
              <span className="font-semibold">Pay Per Crawl</span> beta program. As a Signed Agent, all requests include:
            </p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>HTTP Message Signature headers proving authenticity</li>
              <li>Signature-Agent header referencing public key directory</li>
              <li>Cryptographic proof of domain ownership</li>
            </ul>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              Website operators using Cloudflare can verify request authenticity and opt into pay-per-crawl billing
              for bot traffic originating from this system.
            </p>
          </div>

          {/* Section 7 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              7. Legal and Compliance
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              7.1 Applicable Laws
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-3 font-inter">This bot operates in compliance with:</p>
            <ul className="list-disc ml-4 sm:ml-[27px] space-y-2 mb-6 text-sm sm:text-base md:text-lg text-foreground font-inter">
              <li>Computer Fraud and Abuse Act (CFAA), 18 U.S.C. § 1030</li>
              <li>Health Insurance Portability and Accountability Act (HIPAA) Privacy and Security Rules</li>
              <li>Federal and state data protection regulations</li>
              <li>Terms of Service of accessed websites (where applicable to government work)</li>
            </ul>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              7.2 Liability and Indemnification
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              Nava Public Benefit Corporation maintains appropriate insurance coverage and indemnification agreements
              with client government agencies for services provided via this system.
            </p>
          </div>

          {/* Section 8 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              8. Contact and Dispute Resolution
            </h2>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              8.1 Technical Support
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-4 font-inter">
              For technical issues, verification questions, or access control requests, contact:{' '}
              <a href="mailto:labs-asp@navapbc.com" className="underline hover:no-underline">labs-asp@navapbc.com</a>
            </p>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              8.2 Security Reports
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-4 font-inter">
              To report security vulnerabilities or suspected abuse, contact:{' '}
              <a href="mailto:labs-asp@navapbc.com" className="underline hover:no-underline">labs-asp@navapbc.com</a>
            </p>

            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 font-inter">
              8.3 Website Operator Requests
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              Website operators wishing to block this bot, adjust rate limits, or negotiate access terms should
              contact: <a href="mailto:labs@navapbc.com" className="underline hover:no-underline">labs@navapbc.com</a>
            </p>
          </div>

          {/* Section 9 */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-4 font-source-serif">
              9. Source Code and Transparency
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-foreground mb-6 font-inter">
              This project is open source. The complete codebase, infrastructure configuration, and deployment
              documentation are available at:{' '}
              <a
                href="https://github.com/navapbc/labs-asp"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                https://github.com/navapbc/labs-asp
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-border pt-6 mt-8">
            <p className="text-xs sm:text-sm text-muted-foreground font-inter space-y-1">
              <span className="block"><span className="font-semibold">Last Updated:</span> November 18, 2025</span>
              <span className="block"><span className="font-semibold">Bot Version:</span> 1.0</span>
              <span className="block"><span className="font-semibold">Document Version:</span> 1.0</span>
              <span className="block"><span className="font-semibold">Cloudflare Verification Status:</span> Pending Registration</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
