export type GoogleConnectorOptions = {
  enabled: boolean;
  accessToken?: string;
};

export function withGoogleConnector(
  tools: any[],
  { enabled, accessToken }: GoogleConnectorOptions
): any[] {
  if (!enabled || !accessToken) return tools;
  return [
    ...tools,
    {
      type: "mcp",
      server_label: "GoogleCalendar",
      server_description: "Search the user's calendar and read calendar events",
      connector_id: "connector_googlecalendar",
      authorization: accessToken,
      // Defaults to requiring approval; this demo disables prompts for approval
      require_approval: "never",
    },
    {
      type: "mcp",
      server_label: "GoogleMail",
      server_description: "Search the user's email inbox and read emails",
      connector_id: "connector_gmail",
      authorization: accessToken,
      // Defaults to requiring approval; this demo disables prompts for approval
      require_approval: "never",
    },
  ];
}
