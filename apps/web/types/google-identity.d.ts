/**
 * Google Identity Services (GIS) 类型声明
 *
 * @see https://developers.google.com/identity/gsi/web/reference/js-reference
 */

interface CredentialResponse {
  /** Google ID Token (JWT) */
  credential: string;
  /** How the credential was selected */
  select_by: string;
  clientId?: string;
}

interface IdConfiguration {
  client_id: string;
  auto_select?: boolean;
  callback: (response: CredentialResponse) => void;
  login_uri?: string;
  native_callback?: (response: { id: string }) => void;
  cancel_on_tap_outside?: boolean;
  prompt_parent_id?: string;
  state_cookie_domain?: string;
  /** "signin" | "signup" | "use" */
  context?: string;
  itp_support?: boolean;
  /** Opt into FedCM when available (Chrome) */
  use_fedcm_for_prompt?: boolean;
}

interface PromptMomentNotification {
  isDisplayMoment(): boolean;
  isDisplayed(): boolean;
  isNotDisplayed(): boolean;
  getNotDisplayedReason(): string;
  isSkippedMoment(): boolean;
  getSkippedReason(): string;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

type MomentListener = (notification: PromptMomentNotification) => void;

interface GoogleAccountsId {
  initialize: (config: IdConfiguration) => void;
  prompt: (momentListener?: MomentListener) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      width?: number;
    },
    clickHandler?: () => void
  ) => void;
  disableAutoSelect: () => void;
  storeCredential: (
    credential: { id: string; password: string },
    callback?: () => void
  ) => void;
  cancel: () => void;
  revoke: (
    hint: string,
    callback?: (response: { successful: boolean; error?: string }) => void
  ) => void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface Window {
  google?: {
    accounts: GoogleAccounts;
  };
}
