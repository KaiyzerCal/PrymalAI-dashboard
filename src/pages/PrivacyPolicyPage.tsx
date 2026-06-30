export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => window.location.href = '/'}
          className="mb-8 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Back to Home
        </button>

        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2 text-white">Privacy Policy</h1>
          <p className="text-slate-400 mb-8">
            <strong>Effective Date:</strong> June 27, 2026<br />
            <strong>Last Updated:</strong> June 27, 2026
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">1. Introduction</h2>
          <p>
            Prymal AI ("we," "us," "our," or "Company") operates the Prymal AI platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and otherwise handle your information when you use our Service.
          </p>
          <p>
            Please read this Privacy Policy carefully. By accessing or using Prymal AI, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">2. Information We Collect</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.1 Information You Provide Directly</h3>

          <p><strong>Account Registration:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email address</li>
            <li>Password (hashed, never stored in plain text)</li>
            <li>Business name</li>
            <li>Contact name</li>
            <li>Industry</li>
            <li>Website URL</li>
            <li>Brand tone and knowledge base (optional)</li>
          </ul>

          <p><strong>Credentials:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Google OAuth tokens (encrypted, stored securely)</li>
            <li>These tokens allow Prymal to act on your behalf within your Google Workspace, strictly within the scopes you authorize</li>
          </ul>

          <p><strong>User-Generated Content:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Chat messages and conversations with the AI agent</li>
            <li>Email drafts and content created by the agent</li>
            <li>Calendar events, tasks, and other Google Workspace data accessed through the agent</li>
            <li>Approval/rejection of agent actions</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.2 Information Collected Automatically</h3>

          <p><strong>Usage Data:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Log entries (timestamps, agent actions, errors)</li>
            <li>Feature usage analytics</li>
            <li>Approval queue activity</li>
            <li>Device/browser information (IP address, user agent)</li>
            <li>Session duration and frequency</li>
          </ul>

          <p><strong>Google Workspace Data:</strong></p>
          <p>When you connect your Google account, we access only the data necessary for the Service:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Emails (Gmail)</li>
            <li>Calendar events</li>
            <li>Tasks</li>
            <li>Files (Google Drive metadata and content)</li>
            <li>Google Business Profile data (if connected)</li>
            <li>Contacts and Photos (if enabled)</li>
          </ul>

          <p><strong>No Cookies:</strong> We do not use tracking cookies. Session management is handled through secure authentication tokens.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">3. How We Use Your Information</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.1 Core Service Delivery</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Process your requests through the Google Agent</li>
            <li>Authenticate with your Google Workspace and AI service providers</li>
            <li>Display your data in the Prymal dashboard</li>
            <li>Queue actions for your approval before execution</li>
            <li>Generate AI responses using your chosen AI service (Anthropic Claude Haiku or Google Gemini)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.2 Service Improvement</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Analyze aggregated, non-identifying usage patterns</li>
            <li>Identify and fix bugs or service errors</li>
            <li>Improve performance and user experience</li>
            <li><strong>We do NOT use your personal data to train AI models</strong></li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.3 Legal & Safety</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Comply with applicable laws</li>
            <li>Enforce our Terms of Service</li>
            <li>Investigate and prevent fraud or abuse</li>
            <li>Protect the security of our Service</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.4 What We Do NOT Do</h3>
          <ul className="list-disc list-inside mb-4">
            <li>❌ We do NOT sell your personal data to third parties</li>
            <li>❌ We do NOT access or read your Google Workspace data for marketing</li>
            <li>❌ We do NOT use your data to train our own AI models</li>
            <li>❌ We do NOT share your Google OAuth tokens with anyone</li>
            <li>❌ We do NOT store unencrypted credentials</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">4. Data Retention</h2>

          <table className="w-full border-collapse border border-slate-600 mb-6">
            <thead>
              <tr className="bg-slate-900">
                <th className="border border-slate-600 p-3 text-left">Data Type</th>
                <th className="border border-slate-600 p-3 text-left">Retention Period</th>
                <th className="border border-slate-600 p-3 text-left">Deletion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-600 p-3">Account Information</td>
                <td className="border border-slate-600 p-3">Active account + 30 days after cancellation</td>
                <td className="border border-slate-600 p-3">On request anytime</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3">Chat History & Logs</td>
                <td className="border border-slate-600 p-3">Active account + 90 days after cancellation</td>
                <td className="border border-slate-600 p-3">Users can delete anytime via dashboard</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3">Google OAuth Tokens</td>
                <td className="border border-slate-600 p-3">Until revoked by user or automatic expiry</td>
                <td className="border border-slate-600 p-3">Immediately upon revocation</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3">API Keys</td>
                <td className="border border-slate-600 p-3">Until deleted by user</td>
                <td className="border border-slate-600 p-3">Immediately upon deletion</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3">Approval Queue Items</td>
                <td className="border border-slate-600 p-3">1 year after action</td>
                <td className="border border-slate-600 p-3">On request</td>
              </tr>
            </tbody>
          </table>

          <p><strong>Account Deletion:</strong> When you delete your account, we permanently delete:</p>
          <ul className="list-disc list-inside mb-4">
            <li>All your personal information</li>
            <li>Chat history and conversations</li>
            <li>Approval logs</li>
            <li>Any stored credentials</li>
          </ul>

          <p>Google Workspace data remains in your Google account — we never copy or keep it.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">5. How We Protect Your Data</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.1 Encryption</h3>
          <ul className="list-disc list-inside mb-4">
            <li><strong>In Transit:</strong> All data is transmitted via HTTPS/TLS encryption</li>
            <li><strong>At Rest:</strong> API keys and sensitive credentials are encrypted using industry-standard encryption (AES-256)</li>
            <li><strong>Database:</strong> Hosted on Supabase with encryption at rest</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.2 Access Controls</h3>
          <ul className="list-disc list-inside mb-4">
            <li><strong>Row-Level Security (RLS):</strong> Database policies ensure users can only access their own data</li>
            <li><strong>Authentication:</strong> Supabase Auth with JWT tokens</li>
            <li><strong>API Keys:</strong> Only used for server-to-server requests; never exposed to client</li>
            <li><strong>Employees:</strong> Only essential personnel access data; all access is logged</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.3 Credential Security</h3>
          <ul className="list-disc list-inside mb-4">
            <li><strong>AI API Keys:</strong> Platform-level API keys (Anthropic, Gemini) are stored as encrypted environment secrets and never exposed to users or client-side code</li>
            <li><strong>Your Google OAuth Token:</strong> Stored encrypted. Used ONLY to authenticate requests to your own Google Workspace on your behalf</li>
            <li><strong>We NEVER:</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Share your OAuth tokens with third parties</li>
                <li>Log token values</li>
                <li>Use your Google access beyond what you've explicitly authorized</li>
              </ul>
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.4 Infrastructure Security</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Hosted on Supabase (SOC 2 Type II compliant)</li>
            <li>Regular security updates and patches</li>
            <li>DDoS protection</li>
            <li>Automatic backups</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">6. Third-Party Services</h2>

          <p>Our Service integrates with:</p>
          <table className="w-full border-collapse border border-slate-600 mb-6">
            <thead>
              <tr className="bg-slate-900">
                <th className="border border-slate-600 p-3 text-left">Service</th>
                <th className="border border-slate-600 p-3 text-left">Purpose</th>
                <th className="border border-slate-600 p-3 text-left">Data Shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Google OAuth</strong></td>
                <td className="border border-slate-600 p-3">Authentication & Workspace access</td>
                <td className="border border-slate-600 p-3">Your Google identity; authorized data only</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Anthropic API</strong></td>
                <td className="border border-slate-600 p-3">Primary AI processing (Claude Haiku)</td>
                <td className="border border-slate-600 p-3">Your chat messages and requests (encrypted in transit, never your Google data directly)</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Google Gemini API</strong></td>
                <td className="border border-slate-600 p-3">Fallback AI processing</td>
                <td className="border border-slate-600 p-3">Your chat messages and requests (encrypted in transit)</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Supabase</strong></td>
                <td className="border border-slate-600 p-3">Database & authentication</td>
                <td className="border border-slate-600 p-3">Encrypted user data, credentials</td>
              </tr>
            </tbody>
          </table>

          <p><strong>Important:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>We do NOT use your Google data for AI training</li>
            <li>We do NOT share your Google OAuth tokens with Anthropic or Gemini</li>
            <li>Each service receives only what's necessary for that function</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">7. Your Rights & Choices</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.1 Access Your Data</h3>
          <p>Request a copy of all personal data we hold about you. Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.2 Delete Your Data</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Delete individual chat messages from your dashboard</li>
            <li>Delete your entire account (permanent deletion of all data)</li>
            <li>Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a> for manual deletion</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.3 Revoke Access</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Disconnect Google from Settings → Integrations (revokes our access)</li>
            <li>Delete your API keys from Settings → Integrations anytime</li>
            <li>Revoke Prymal's access in Google Account Settings</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.4 Data Portability</h3>
          <p>We can provide your data in a structured format (JSON). Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.5 GDPR Rights (EU Users)</h3>
          <p>If you're in the EU, you have additional rights:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Right to access your data</li>
            <li>Right to rectification</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object</li>
          </ul>
          <p>Contact: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.6 CCPA Rights (California Residents)</h3>
          <p>If you're in California, you have the right to:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Know what personal data is collected</li>
            <li>Know whether your data is sold or disclosed</li>
            <li>Delete your data</li>
            <li>Opt-out of data sales</li>
            <li>Non-discrimination for exercising your rights</li>
          </ul>
          <p>Contact: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">8. Children's Privacy</h2>
          <p>Prymal AI is not intended for users under 18. We do not knowingly collect information from children under 18. If we discover that a child under 18 has provided us information, we will delete it immediately.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">9. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy to reflect changes in our practices, technology, or legal requirements. We will notify you of material changes via:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Email to your registered email address</li>
            <li>Prominent notice on our platform</li>
            <li>Updated "Last Updated" date</li>
          </ul>
          <p>Continued use of the Service after changes constitutes acceptance.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">10. Contact Us</h2>

          <p><strong>Privacy Questions:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></li>
          </ul>

          <p><strong>Data Subject Requests (GDPR):</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></li>
            <li>Include "GDPR Request" in subject line</li>
          </ul>

          <p><strong>Security Issues:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:security@prymalai.com" className="text-cyan-400 hover:text-cyan-300">security@prymalai.com</a></li>
            <li>Do NOT include sensitive data in emails</li>
          </ul>

          <p><strong>Complaints (EU):</strong></p>
          <p>If you believe we've violated your rights, you have the right to lodge a complaint with your local data protection authority.</p>

          <hr className="border-slate-700 my-12" />

          <p className="text-center text-slate-400">
            <strong>Prymal AI</strong><br />
            Building autonomous AI for Google Workspace<br />
            Last Updated: June 27, 2026
          </p>
        </div>
      </div>
    </div>
  )
}
