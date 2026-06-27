export function SecurityPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => window.location.href = '/landing'}
          className="mb-8 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Back to Home
        </button>

        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2 text-white">Security & Data Protection Policy</h1>
          <p className="text-slate-400 mb-8">
            <strong>Effective Date:</strong> June 27, 2026<br />
            <strong>Last Updated:</strong> June 27, 2026
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">1. Security Overview</h2>

          <p>
            Prymal AI is committed to protecting your data and maintaining the security of our Service. This document outlines our security practices, data protection measures, and your responsibilities.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">2. Data Security Architecture</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.1 Encryption</h3>

          <p><strong>In Transit (Encryption in Flight):</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>All connections use HTTPS/TLS 1.2 or higher</li>
            <li>API communication with Google, Anthropic, and Gemini uses encrypted channels</li>
            <li>WebSocket connections are secured with TLS</li>
            <li>No unencrypted HTTP traffic is permitted</li>
          </ul>

          <p><strong>At Rest (Encryption on Disk):</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Database hosted on Supabase with encryption at rest</li>
            <li>Sensitive fields encrypted with AES-256:
              <ul className="list-disc list-inside ml-4">
                <li>API keys (Anthropic, Gemini, Google OAuth tokens)</li>
                <li>Passwords (hashed with bcrypt, not encrypted)</li>
                <li>Sensitive credentials</li>
              </ul>
            </li>
            <li>Backups are encrypted</li>
          </ul>

          <p><strong>Key Management:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Encryption keys are managed by Supabase's infrastructure</li>
            <li>Keys are not stored with encrypted data</li>
            <li>Regular key rotation per industry standards</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.2 Authentication & Authorization</h3>

          <p><strong>Authentication:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Supabase Auth with OAuth 2.0</li>
            <li>JWT tokens issued upon login</li>
            <li>Tokens expire after 1 hour of inactivity</li>
            <li>Optional: Multi-factor authentication (coming soon)</li>
            <li>Passwords must be at least 8 characters</li>
          </ul>

          <p><strong>Authorization:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Row-Level Security (RLS) policies on all tables</li>
            <li>Users can only access their own data</li>
            <li>Database policies enforce ownership checks</li>
            <li>API endpoints validate user ownership before returning data</li>
          </ul>

          <p><strong>Hashing:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Passwords are hashed using bcrypt (never stored in plain text)</li>
            <li>API keys are encrypted (not hashed, so they can be used)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.3 API Key Security</h3>

          <p><strong>How We Handle Your Keys:</strong></p>

          <table className="w-full border-collapse border border-slate-600 mb-6">
            <thead>
              <tr className="bg-slate-900">
                <th className="border border-slate-600 p-3 text-left">Key Type</th>
                <th className="border border-slate-600 p-3 text-left">Storage</th>
                <th className="border border-slate-600 p-3 text-left">Usage</th>
                <th className="border border-slate-600 p-3 text-left">Security</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Anthropic API Key</strong></td>
                <td className="border border-slate-600 p-3">Encrypted in database</td>
                <td className="border border-slate-600 p-3">Server-to-server requests only</td>
                <td className="border border-slate-600 p-3">Never logged, never shared</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Gemini API Key</strong></td>
                <td className="border border-slate-600 p-3">Encrypted in database</td>
                <td className="border border-slate-600 p-3">Server-to-server requests only</td>
                <td className="border border-slate-600 p-3">Never logged, never shared</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Google OAuth Token</strong></td>
                <td className="border border-slate-600 p-3">Encrypted in database</td>
                <td className="border border-slate-600 p-3">Server-to-server requests only</td>
                <td className="border border-slate-600 p-3">Never logged, never shared</td>
              </tr>
            </tbody>
          </table>

          <p><strong>What We Guarantee:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>✓ Keys are encrypted at rest using AES-256</li>
            <li>✓ Keys are transmitted over HTTPS only</li>
            <li>✓ Keys are never logged or inspected</li>
            <li>✓ Keys are never shared with anyone</li>
            <li>✓ Keys are deleted immediately when you remove them</li>
            <li>✓ You can revoke access anytime without our involvement</li>
          </ul>

          <p><strong>What You Should Do:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Rotate your API keys periodically</li>
            <li>Monitor your API usage for unauthorized activity</li>
            <li>Revoke Prymal's access if you stop using the Service</li>
            <li>Use strong, unique passwords for each API service</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">3. Infrastructure Security</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.1 Hosting & Infrastructure</h3>

          <p><strong>Primary Services:</strong></p>

          <ul className="list-disc list-inside mb-4">
            <li><strong>Database:</strong> Supabase (PostgreSQL)
              <ul className="list-disc list-inside ml-4">
                <li>SOC 2 Type II certified</li>
                <li>Automatic daily backups</li>
                <li>Point-in-time recovery (up to 7 days)</li>
                <li>DDoS protection</li>
              </ul>
            </li>
            <li><strong>Edge Functions:</strong> Supabase Edge Functions (Deno runtime)
              <ul className="list-disc list-inside ml-4">
                <li>Runs in secure Deno sandbox</li>
                <li>No direct filesystem access</li>
                <li>Network requests are monitored</li>
              </ul>
            </li>
            <li><strong>Frontend:</strong> Deployed on Vercel
              <ul className="list-disc list-inside ml-4">
                <li>CDN with global distribution</li>
                <li>DDoS mitigation</li>
                <li>Automatic SSL/TLS</li>
                <li>Zero-downtime deployments</li>
              </ul>
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.2 Network Security</h3>

          <p><strong>Firewalls & DDoS Protection:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Supabase DDoS protection blocks malicious traffic</li>
            <li>Rate limiting on API endpoints</li>
            <li>Request validation on all inputs</li>
            <li>SQL injection prevention via parameterized queries</li>
          </ul>

          <p><strong>VPN & Private Networks:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Database accessible only from our Edge Functions (IP whitelisting)</li>
            <li>No public database access</li>
            <li>Secure inter-service communication</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.3 Access Control</h3>

          <p><strong>Employee Access:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Only essential personnel access production data</li>
            <li>All access is logged and audited</li>
            <li>Employees sign NDAs</li>
            <li>Access is restricted by role (least privilege principle)</li>
            <li>No direct database access without logging</li>
          </ul>

          <p><strong>Zero Trust Model:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Every request is authenticated</li>
            <li>Every action is authorized</li>
            <li>Access is verified at every step</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">4. Data Protection Practices</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.1 Input Validation</h3>

          <p><strong>All user input is:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Validated for type and format</li>
            <li>Escaped before database insertion (prevents SQL injection)</li>
            <li>Length-limited to prevent buffer overflows</li>
            <li>Checked for malicious patterns</li>
          </ul>

          <p><strong>Parameterized Queries:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>All database queries use prepared statements</li>
            <li>User input is never concatenated into queries</li>
            <li>Protects against SQL injection attacks</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.2 Output Encoding</h3>

          <ul className="list-disc list-inside mb-4">
            <li>HTML output is properly escaped</li>
            <li>JSON responses use standard encoding</li>
            <li>Prevents XSS (Cross-Site Scripting) attacks</li>
            <li>CSRF (Cross-Site Request Forgery) tokens on all state-changing operations</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.3 Session Management</h3>

          <p><strong>Sessions are secured via:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Secure, HttpOnly JWT cookies (cannot be accessed by JavaScript)</li>
            <li>SameSite cookie attribute prevents CSRF</li>
            <li>Tokens expire after 1 hour of inactivity</li>
            <li>Logout immediately invalidates tokens</li>
            <li>Sessions are tied to specific devices (user agent and IP)</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">5. Logging & Monitoring</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.1 What We Log</h3>

          <p><strong>Access Logs:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Login/logout events</li>
            <li>API endpoint requests (without sensitive data)</li>
            <li>Failed authentication attempts</li>
            <li>Account changes (email, password, settings)</li>
          </ul>

          <p><strong>Activity Logs:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Actions queued for approval</li>
            <li>Approved/rejected actions</li>
            <li>Agent operations</li>
            <li>Error messages (without sensitive details)</li>
          </ul>

          <p><strong>Security Events:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Unusual login patterns (multiple locations, rapid succession)</li>
            <li>Rate limit violations</li>
            <li>Potential abuse patterns</li>
            <li>Failed API requests</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.2 What We Do NOT Log</h3>

          <ul className="list-disc list-inside mb-4">
            <li>❌ API key values</li>
            <li>❌ Password values</li>
            <li>❌ Full email content or attachments</li>
            <li>❌ Full file contents</li>
            <li>❌ Google Workspace data beyond metadata</li>
            <li>❌ Unencrypted credentials</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.3 Log Retention</h3>

          <ul className="list-disc list-inside mb-4">
            <li>Logs are retained for 90 days</li>
            <li>Older logs are automatically deleted</li>
            <li>You can request deletion of your logs anytime</li>
            <li>Logs are encrypted and access-controlled</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.4 Monitoring & Alerting</h3>

          <p><strong>Real-Time Monitoring:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Automated alerts for failed login attempts (&gt;5 in 10 minutes)</li>
            <li>Alerts for unauthorized access attempts</li>
            <li>Alerts for unusual API usage patterns</li>
            <li>Performance monitoring (latency, error rates)</li>
          </ul>

          <p><strong>Human Review:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Security team reviews alerts daily</li>
            <li>Escalation process for serious incidents</li>
            <li>Investigation of potential breaches</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">6. Incident Response</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.1 Security Incident Handling</h3>

          <p>If we discover a security incident:</p>

          <ol className="list-decimal list-inside mb-4">
            <li><strong>Detection & Containment (0-4 hours)</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Incident is identified and isolated</li>
                <li>Affected systems are secured</li>
                <li>Further damage is prevented</li>
              </ul>
            </li>
            <li><strong>Investigation (4-24 hours)</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Root cause analysis</li>
                <li>Scope of impact determined</li>
                <li>Logs reviewed for unauthorized access</li>
              </ul>
            </li>
            <li><strong>Notification (24 hours)</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Affected users are notified via email</li>
                <li>Details of the breach are disclosed</li>
                <li>Recommended actions are provided</li>
                <li>Transparency in communication</li>
              </ul>
            </li>
            <li><strong>Remediation (24-72 hours)</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Vulnerability is patched</li>
                <li>Systems are hardened</li>
                <li>Additional monitoring is enabled</li>
              </ul>
            </li>
            <li><strong>Post-Incident Review (1 week)</strong>
              <ul className="list-disc list-inside ml-4">
                <li>Lessons learned documented</li>
                <li>Preventive measures implemented</li>
                <li>Security practices are improved</li>
              </ul>
            </li>
          </ol>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.2 Your Responsibilities During an Incident</h3>

          <p>If a breach occurs:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Change your password immediately</li>
            <li>Rotate your API keys</li>
            <li>Monitor your Google Workspace and API usage</li>
            <li>Contact us if you notice suspicious activity</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">7. Compliance & Certifications</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.1 Standards Compliance</h3>

          <p><strong>We comply with:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li><strong>GDPR</strong> (EU General Data Protection Regulation)</li>
            <li><strong>CCPA</strong> (California Consumer Privacy Act)</li>
            <li><strong>HIPAA</strong> (Health Insurance Portability and Accountability Act) — if you use it for healthcare</li>
            <li><strong>SOC 2 Type II</strong> (via Supabase)</li>
            <li><strong>OWASP Top 10</strong> security practices</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.2 Third-Party Security</h3>

          <p><strong>Our providers are certified:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Supabase: SOC 2 Type II, GDPR compliant, ISO 27001 certified</li>
            <li>Vercel: SOC 2 Type II, GDPR compliant</li>
            <li>Anthropic: Complies with AI safety standards</li>
            <li>Google: SOC 2 Type II, GDPR compliant</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">8. Vulnerability Disclosure</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">8.1 Reporting Security Issues</h3>

          <p>If you discover a security vulnerability:</p>

          <p><strong>Email:</strong> <a href="mailto:security@prymalai.com" className="text-cyan-400 hover:text-cyan-300">security@prymalai.com</a></p>
          <p><strong>Include:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Description of the vulnerability</li>
            <li>Steps to reproduce</li>
            <li>Potential impact</li>
            <li>Your contact information</li>
          </ul>

          <p><strong>DO NOT:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Publicly disclose the vulnerability</li>
            <li>Exploit the vulnerability</li>
            <li>Access other users' data</li>
            <li>Perform denial-of-service attacks</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">8.2 Responsible Disclosure</h3>

          <p><strong>Our Commitment:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Acknowledge receipt within 24 hours</li>
            <li>Provide initial assessment within 1 week</li>
            <li>Develop and test a fix within 2 weeks</li>
            <li>Deploy a patch within 4 weeks</li>
            <li>Public disclosure 30 days after patch (coordinated with you)</li>
            <li>Credit the security researcher (if desired)</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">9. Data Deletion & Purging</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">9.1 User-Initiated Deletion</h3>

          <p><strong>When you delete your account:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>All personal data is permanently deleted within 24 hours</li>
            <li>Chat history and logs are purged</li>
            <li>Database records are removed</li>
            <li>Backups are retained for 7 days only</li>
            <li>After 7 days, all data is gone</li>
          </ul>

          <p><strong>When you delete data from dashboard:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Chat messages are immediately deleted</li>
            <li>Deletions are permanent</li>
            <li>No recovery is possible</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">9.2 Automatic Deletion</h3>

          <p><strong>We automatically delete:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Expired sessions (after 1 hour of inactivity)</li>
            <li>Failed login attempts (after 30 days)</li>
            <li>Approval logs (after 1 year)</li>
            <li>Temporary files (within 24 hours)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">9.3 Backup & Recovery</h3>

          <p><strong>Data backups:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Automatic daily backups to encrypted storage</li>
            <li>Backups are encrypted like production data</li>
            <li>Backups are retained for up to 30 days</li>
            <li>Access to backups is restricted</li>
            <li>Deleted data is purged from backups after 30 days</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">10. Security Updates & Patches</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">10.1 Patching Schedule</h3>

          <p><strong>Critical Security Patches:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Deployed within 24 hours of discovery</li>
            <li>No downtime required</li>
            <li>Automatically deployed</li>
          </ul>

          <p><strong>Regular Updates:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Security updates deployed monthly</li>
            <li>Other updates deployed as needed</li>
            <li>Notifications sent 24 hours before major updates</li>
            <li>No data loss or service disruption</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">10.2 Dependency Management</h3>

          <ul className="list-disc list-inside mb-4">
            <li>We regularly scan dependencies for vulnerabilities</li>
            <li>Libraries are updated as patches become available</li>
            <li>Outdated dependencies are replaced</li>
            <li>Build system checks for security issues</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">11. User Security Responsibilities</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.1 Password Security</h3>

          <p><strong>You should:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Use strong, unique passwords (12+ characters, mixed case, numbers, symbols)</li>
            <li>Never reuse passwords across services</li>
            <li>Use a password manager (1Password, Bitwarden, etc.)</li>
            <li>Change passwords regularly (every 90 days)</li>
            <li>Never share your password</li>
          </ul>

          <p><strong>We will:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Hash passwords with bcrypt (industry standard)</li>
            <li>Never send passwords via email</li>
            <li>Never display your password</li>
            <li>Force password resets for security breaches</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.2 API Key Security</h3>

          <p><strong>You should:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Treat API keys like passwords</li>
            <li>Rotate API keys every 90 days</li>
            <li>Revoke unused keys immediately</li>
            <li>Monitor your API usage</li>
            <li>Use different keys for different purposes</li>
            <li>Never commit keys to version control</li>
          </ul>

          <p><strong>We will:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Encrypt keys at rest</li>
            <li>Never log key values</li>
            <li>Only use keys for your authorized requests</li>
            <li>Delete keys immediately when you request removal</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.3 Account Activity Monitoring</h3>

          <p><strong>You should:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Review login history regularly</li>
            <li>Check approval activity for unauthorized requests</li>
            <li>Monitor your Google Workspace for suspicious changes</li>
            <li>Report unusual activity immediately</li>
          </ul>

          <p><strong>We will:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Alert you to new login locations</li>
            <li>Alert you to multiple failed login attempts</li>
            <li>Log all account activity</li>
            <li>Investigate suspicious patterns</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">12. Security Awareness</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">12.1 Phishing Protection</h3>

          <p><strong>Prymal AI will NEVER:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email you asking for your password</li>
            <li>Email you asking for your API keys</li>
            <li>Ask you to verify credentials via email</li>
            <li>Email from non-official domains</li>
          </ul>

          <p><strong>If you receive a suspicious email claiming to be from Prymal:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Do NOT click any links</li>
            <li>Do NOT provide credentials</li>
            <li>Forward it to <a href="mailto:security@prymalai.com" className="text-cyan-400 hover:text-cyan-300">security@prymalai.com</a></li>
            <li>We will investigate</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">12.2 Two-Factor Authentication (Coming Soon)</h3>

          <p>We are implementing 2FA for additional account security:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Optional: You can enable 2FA on your account</li>
            <li>Required: We may require 2FA for enterprise customers</li>
            <li>Methods supported: Authenticator apps (Google Authenticator, Authy)</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">13. Third-Party Security Assessments</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.1 Penetration Testing</h3>

          <ul className="list-disc list-inside mb-4">
            <li>We conduct penetration testing annually</li>
            <li>Third-party security firms perform independent assessments</li>
            <li>Results are used to improve security</li>
            <li>Critical issues are fixed immediately</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.2 Code Reviews</h3>

          <ul className="list-disc list-inside mb-4">
            <li>All code is reviewed before deployment</li>
            <li>Security-focused code review checklist</li>
            <li>Static analysis tools scan for vulnerabilities</li>
            <li>No code is deployed without approval</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.3 Dependency Scanning</h3>

          <ul className="list-disc list-inside mb-4">
            <li>Automated scanning for vulnerable dependencies</li>
            <li>Security alerts for new CVEs</li>
            <li>Automatic updates for critical vulnerabilities</li>
            <li>Manual review and testing before deployment</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">14. Compliance & Auditing</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">14.1 Audit Trail</h3>

          <p><strong>We maintain:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Complete audit logs of data access</li>
            <li>All administrative actions logged</li>
            <li>All API requests logged (without sensitive data)</li>
            <li>All authentication attempts logged</li>
            <li>All access to user data logged</li>
          </ul>

          <p><strong>You can:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Request your audit log anytime</li>
            <li>Review who accessed your data</li>
            <li>Identify suspicious access patterns</li>
            <li>Verify compliance with your policies</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">14.2 Data Processing Agreement (DPA)</h3>

          <p>For enterprise customers, we offer a Data Processing Agreement that:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Outlines how we process your data</li>
            <li>Commits to GDPR and CCPA compliance</li>
            <li>Details your rights and our obligations</li>
            <li>Provides security commitments</li>
          </ul>

          <p><strong>Request a DPA:</strong> <a href="mailto:legal@prymalai.com" className="text-cyan-400 hover:text-cyan-300">legal@prymalai.com</a></p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">15. Changes to Security Practices</h2>

          <p>We may update this policy to reflect:</p>
          <ul className="list-disc list-inside mb-4">
            <li>New security threats</li>
            <li>Industry best practices</li>
            <li>Regulatory changes</li>
            <li>Improved protections</li>
          </ul>

          <p><strong>We will notify you of material changes via:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email to your registered address</li>
            <li>Updated policy on our website</li>
            <li>30-day advance notice (where required)</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">16. Contact & Support</h2>

          <p><strong>Security Issues:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:security@prymalai.com" className="text-cyan-400 hover:text-cyan-300">security@prymalai.com</a></li>
            <li>Response: Within 24 hours</li>
            <li>Keep details confidential until patch is deployed</li>
          </ul>

          <p><strong>Privacy Concerns:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:privacy@prymalai.com" className="text-cyan-400 hover:text-cyan-300">privacy@prymalai.com</a></li>
            <li>Response: Within 48 hours</li>
          </ul>

          <p><strong>Compliance Questions:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:legal@prymalai.com" className="text-cyan-400 hover:text-cyan-300">legal@prymalai.com</a></li>
            <li>Response: Within 5 business days</li>
          </ul>

          <p><strong>General Support:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:support@prymalai.com" className="text-cyan-400 hover:text-cyan-300">support@prymalai.com</a></li>
            <li>Response: Within 48 business hours</li>
          </ul>

          <hr className="border-slate-700 my-12" />

          <p className="text-center text-slate-400">
            <strong>Prymal AI</strong><br />
            Building autonomous AI for Google Workspace<br />
            Last Updated: June 27, 2026
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">Commitment to Security</h2>

          <p>
            At Prymal AI, security is not an afterthought—it's foundational. We invest in:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>State-of-the-art encryption</li>
            <li>Regular security audits</li>
            <li>Continuous monitoring</li>
            <li>Rapid incident response</li>
            <li>Transparency with users</li>
          </ul>

          <p>
            Your trust is our most valuable asset. We work every day to earn and maintain it.
          </p>
        </div>
      </div>
    </div>
  )
}
