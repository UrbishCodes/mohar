export type UserType = "student" | "freelancer" | "business";

export interface Profile {
  id: string;
  email: string;
  username: string;
  user_type: UserType;
  business_name: string | null;
  business_city: string | null;
  business_state: string | null;
  freelance_work: string | null;
  wallet_address: string | null;
  marketing_opt_in: boolean;
  marketing_consented_at: string | null;
  terms_version: string;
  privacy_version: string;
  created_at: string;
  updated_at: string;
}

export const USER_TYPES: { value: UserType; label: string; hint: string }[] = [
  {
    value: "student",
    label: "Student",
    hint: "No extra details needed.",
  },
  {
    value: "freelancer",
    label: "Freelancer",
    hint: "Tell us what kind of work you do.",
  },
  {
    value: "business",
    label: "Business owner",
    hint: "Your business name plus city and state.",
  },
];

export const TERMS_VERSION = "2026-10-12";
export const PRIVACY_VERSION = "2026-10-12";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_RE.test(username);
}

/** Build a username suggestion from an email address, e.g. "ram_4821". */
export function suggestUsername(email: string): string {
  const local = (email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 12);
  const base = local.length >= 3 ? local : "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`;
}

export interface ProfileFormState {
  username: string;
  userType: UserType | "";
  businessName: string;
  businessCity: string;
  businessState: string;
  freelanceWork: string;
  marketingOptIn: boolean;
  acceptedTerms: boolean;
}

export function emptyForm(): ProfileFormState {
  return {
    username: "",
    userType: "",
    businessName: "",
    businessCity: "",
    businessState: "",
    freelanceWork: "",
    marketingOptIn: false,
    acceptedTerms: false,
  };
}

/** Returns a map of field -> error message. Empty map means valid. */
export function validateProfileForm(
  form: ProfileFormState,
  opts: { requireTerms: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isValidUsernameFormat(form.username.trim())) {
    errors.username =
      "Use 3-20 characters: lowercase letters, numbers, underscores.";
  }
  if (!form.userType) {
    errors.userType = "Pick the option that fits you best.";
  }
  if (form.userType === "business") {
    if (!form.businessName.trim()) errors.businessName = "Business name is required.";
    if (!form.businessCity.trim()) errors.businessCity = "City is required.";
    if (!form.businessState.trim()) errors.businessState = "State is required.";
  }
  if (form.userType === "freelancer" && !form.freelanceWork.trim()) {
    errors.freelanceWork = "Tell us what kind of freelance work you do.";
  }
  if (opts.requireTerms && !form.acceptedTerms) {
    errors.acceptedTerms = "Please accept the Terms and Privacy Policy to continue.";
  }
  return errors;
}
