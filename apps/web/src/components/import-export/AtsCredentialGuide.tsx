import type { ReactNode } from "react";

type Guide = {
  name: string;
  website: string;
  docs: string;
  steps: ReactNode[];
  note?: string;
};

const guides: Record<string, Guide> = {
  workable: {
    name: "Workable",
    website: "https://yourcompany.workable.com/",
    docs: "https://help.workable.com/hc/en-us/articles/115015785428-Generating-revoking-access-tokens-for-Workable-s-API",
    steps: [
      <>
        Open <strong>Settings &gt; Integrations &gt; Apps</strong> and find{" "}
        <strong>API Access Tokens</strong>.
      </>,
      <>
        Click <strong>Generate API token</strong>, name the token, choose its expiry and enable the
        read scopes needed for your import, including jobs and candidates.
      </>,
      <>
        Copy the Bearer token. Enter your company URL below (for example,{" "}
        <code>https://yourcompany.workable.com</code>) and paste the token without the{" "}
        <code>Bearer</code> prefix.
      </>,
    ],
  },
  greenhouse: {
    name: "Greenhouse",
    website: "https://app.greenhouse.io/",
    docs: "https://harvestdocs.greenhouse.io/docs/authentication",
    steps: [
      <>
        Go to <strong>Configure &gt; Dev Center &gt; API Credential Management</strong>.
      </>,
      <>
        Create credentials for <strong>Harvest v3 (OAuth)</strong> for your custom integration.
      </>,
      <>
        Enable the required read scopes for jobs, candidates, applications and associated records
        such as stages, attachments and activity.
      </>,
      <>
        Copy the <strong>client ID</strong> and <strong>client secret</strong> into their separate
        fields below.
      </>,
    ],
    note: "This connector uses Harvest v3 OAuth credentials, not a legacy Harvest v1/v2 API key. Ask your Greenhouse administrator if credential management is unavailable.",
  },
  lever: {
    name: "Lever",
    website: "https://hire.lever.co/",
    docs: "https://hire.lever.co/developer/documentation#authentication",
    steps: [
      <>
        Go to <strong>Settings &gt; Integrations and API &gt; API Credentials</strong>.
      </>,
      <>
        Under <strong>Lever API credentials</strong>, click <strong>Generate New Key</strong> and
        give it a name.
      </>,
      <>
        Select read permissions for candidate opportunities, postings, stages, applications and any
        associated files, notes or interviews you want to import.
      </>,
      <>
        Copy the generated <strong>API key</strong> and paste it below. No password or Base64
        encoding is needed here.
      </>,
    ],
  },
  bamboohr: {
    name: "BambooHR",
    website: "https://yourcompany.bamboohr.com/",
    docs: "https://documentation.bamboohr.com/docs/getting-started",
    steps: [
      <>
        Open your <strong>profile/name menu &gt; API Keys</strong>. The menu may be at the bottom
        left or in your profile avatar, depending on your layout.
      </>,
      <>
        Click <strong>Add New Key</strong>, name it and copy the generated key.
      </>,
      <>
        Enter your company subdomain (for example, <code>yourcompany</code>) and paste the API key
        below.
      </>,
    ],
    note: "The key inherits your BambooHR user's permissions. Your administrator must grant access to recruiting data; an employee-directory-only key is not enough.",
  },
  smartrecruiters: {
    name: "SmartRecruiters",
    website: "https://www.smartrecruiters.com/",
    docs: "https://developers.smartrecruiters.com/docs/authentication-api-key",
    steps: [
      <>
        As an administrator, go to{" "}
        <strong>Settings / Admin &gt; Apps &amp; Integrations &gt; Credentials</strong> (Credential
        Manager).
      </>,
      <>
        Click <strong>New Credential &gt; API Key</strong>, enter a name and description, then click{" "}
        <strong>Generate</strong>.
      </>,
      <>
        Copy the key shown once and paste it below. It is sent as <code>X-SmartToken</code>; paste
        only the key value, not the header name.
      </>,
    ],
    note: "SmartRecruiters API keys grant broad account access. Keep the key private and revoke it when no longer needed.",
  },
  workday: {
    name: "Workday",
    website: "https://www.workday.com/en-us/signin.html",
    docs: "https://developer.workday.com/documentation/GUID-f8d46604-e156-492f-a324-62ed2f6496f7/CreateIntegrationSystemUsersforApps",
    steps: [
      <>
        Ask your Workday administrator to configure an{" "}
        <strong>Integration System User (ISU)</strong> and the required recruiting read permissions.
      </>,
      <>
        Have the administrator prepare the tenant endpoint, credentials and custom report required
        by your integration.
      </>,
      <>
        Enter only your <strong>tenant URL and administrator contact details</strong> below, then
        submit the setup request. Do not paste passwords or client secrets into this notes field.
      </>,
    ],
    note: "Administrator setup is required. Submitting this request does not connect or start an import automatically.",
  },
  icims: {
    name: "iCIMS",
    website: "https://www.icims.com/",
    docs: "https://developer.icims.com/",
    steps: [
      <>
        Contact your <strong>iCIMS system administrator or Integration Specialist</strong> to
        authorize API access.
      </>,
      <>
        Ask them for the approved authentication method, client credentials and your tenant endpoint
        URL, with access to the recruiting records you need.
      </>,
      <>
        Enter only your <strong>tenant URL and administrator contact details</strong> below, then
        submit the setup request. Share secrets only through the approved credential setup, not this
        notes field.
      </>,
    ],
    note: "iCIMS requires provider-specific authorization, not a Workday ISU. This request stays pending until administrator setup is complete.",
  },
};

export function AtsCredentialGuide({ provider }: { provider: string }) {
  const guide = guides[provider];
  if (!guide) return null;

  return (
    <div className="space-y-2 break-words text-sm" data-credential-guide={provider}>
      <h4 className="font-medium">How to get your {guide.name} credentials</h4>
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>
          Log in to your {guide.name} account, for example{" "}
          <a
            href={guide.website}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline underline-offset-2"
          >
            {guide.website}
          </a>
          {guide.website.includes("yourcompany") &&
            " (replace yourcompany with your own company subdomain)"}
          .
        </li>
        {guide.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {guide.note && <p className="text-xs text-muted-foreground">{guide.note}</p>}
      <a
        href={guide.docs}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs underline underline-offset-2"
      >
        {guide.name} setup documentation
      </a>
    </div>
  );
}
