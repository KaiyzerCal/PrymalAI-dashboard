export function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => window.location.href = '/'}
          className="mb-8 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Back to Home
        </button>

        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2 text-white">Contact Us</h1>
          <p className="text-slate-400 mb-8">Get in touch with the Prymal AI team</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* General Support */}
            <div className="border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2 text-cyan-400">General Support</h3>
              <p className="text-slate-300 mb-4">
                Questions about features, billing, or account management
              </p>
              <a
                href="mailto:support@prymalai.com"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                support@prymalai.com
              </a>
              <p className="text-sm text-slate-400 mt-2">
                Response time: Within 48 business hours
              </p>
            </div>

            {/* Security Issues */}
            <div className="border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2 text-cyan-400">Security Issues</h3>
              <p className="text-slate-300 mb-4">
                Report security vulnerabilities and bugs
              </p>
              <a
                href="mailto:security@prymalai.com"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                security@prymalai.com
              </a>
              <p className="text-sm text-slate-400 mt-2">
                Response time: Within 24 hours
              </p>
            </div>

            {/* Privacy Questions */}
            <div className="border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2 text-cyan-400">Privacy Concerns</h3>
              <p className="text-slate-300 mb-4">
                Data access, deletion, or GDPR/CCPA requests
              </p>
              <a
                href="mailto:privacy@prymalai.com"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                privacy@prymalai.com
              </a>
              <p className="text-sm text-slate-400 mt-2">
                Response time: Within 48 hours
              </p>
            </div>

            {/* Legal & Billing */}
            <div className="border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2 text-cyan-400">Legal & Billing</h3>
              <p className="text-slate-300 mb-4">
                Billing issues, contracts, or legal inquiries
              </p>
              <div className="space-y-2">
                <a
                  href="mailto:legal@prymalai.com"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors block"
                >
                  legal@prymalai.com
                </a>
                <a
                  href="mailto:billing@prymalai.com"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors block"
                >
                  billing@prymalai.com
                </a>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Response time: Within 5 business days
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mt-12 mb-4 text-white">Our Policies</h2>
          <p className="text-slate-300 mb-6">
            Learn more about how we protect your data and what we commit to:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <a
              href="/privacy"
              className="border border-slate-700 rounded-lg p-4 hover:border-cyan-400 transition-colors"
            >
              <h3 className="text-lg font-bold mb-2 text-cyan-400">Privacy Policy</h3>
              <p className="text-sm text-slate-400">
                How we collect, use, and protect your data
              </p>
            </a>

            <a
              href="/terms"
              className="border border-slate-700 rounded-lg p-4 hover:border-cyan-400 transition-colors"
            >
              <h3 className="text-lg font-bold mb-2 text-cyan-400">Terms of Service</h3>
              <p className="text-sm text-slate-400">
                Your rights and responsibilities when using Prymal AI
              </p>
            </a>

            <a
              href="/security"
              className="border border-slate-700 rounded-lg p-4 hover:border-cyan-400 transition-colors"
            >
              <h3 className="text-lg font-bold mb-2 text-cyan-400">Security Policy</h3>
              <p className="text-sm text-slate-400">
                How we protect your data and respond to security issues
              </p>
            </a>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-bold mb-3 text-white">Security & Vulnerability Disclosure</h3>
            <p className="text-slate-300 mb-4">
              If you discover a security vulnerability, please report it responsibly to security@prymalai.com.
            </p>
            <p className="text-sm text-slate-400">
              Do not publicly disclose the vulnerability until we've had time to investigate and patch it. We commit to acknowledging your report within 24 hours and providing updates on our progress.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
