interface GoogleOAuth2CodeClient {
  requestCode(): void;
}

interface GoogleOAuth2 {
  initCodeClient(config: {
    client_id: string;
    scope: string;
    ux_mode: string;
    callback: (response: { code?: string }) => void;
  }): GoogleOAuth2CodeClient;
}

interface GoogleAccounts {
  oauth2: GoogleOAuth2;
}

interface Google {
  accounts: GoogleAccounts;
}

interface Window {
  google?: Google;
}

declare const google: Google;

declare const marked: {
  parse(text: string): string;
};