import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConfirm } from "../components/ConfirmDialog";
import type { User } from "@supabase/supabase-js";
import type { View } from "../components/TopBar";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  USER_TYPES,
  TERMS_VERSION,
  PRIVACY_VERSION,
  emptyForm,
  isValidUsernameFormat,
  suggestUsername,
  validateProfileForm,
  type Profile,
  type ProfileFormState,
} from "../lib/profile";

type Phase =
  | "loading"
  | "signed-out"
  | "link-sent"
  | "onboarding"
  | "editing"
  | "saved"
  | "deleted";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilePage({ go }: { go: (v: View) => void }) {
  const { publicKey, connected, disconnect } = useWallet();
  const confirm = useConfirm();
  // Set while the "deleted" confirmation is showing, so the sign-out that
  // follows a profile deletion doesn't yank the phase back to "signed-out".
  const deletedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>(() =>
    isSupabaseConfigured() ? "loading" : "signed-out"
  );
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      setError(`Couldn't load your profile: ${error.message}`);
      setPhase("signed-out");
      return;
    }
    if (data) {
      const p = data as Profile;
      setProfile(p);
      setForm({
        username: p.username,
        userType: p.user_type,
        businessName: p.business_name ?? "",
        businessCity: p.business_city ?? "",
        businessState: p.business_state ?? "",
        freelanceWork: p.freelance_work ?? "",
        marketingOptIn: p.marketing_opt_in,
        acceptedTerms: true,
      });
      setLinkedWallet(p.wallet_address);
      setPhase("editing");
    } else {
      setPhase("onboarding");
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) void loadProfile(u.id);
      else setPhase("signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) void loadProfile(u.id);
      else {
        setProfile(null);
        if (!deletedRef.current) setPhase("signed-out");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Live username availability check (debounced). The reset happens in the
  // input's onChange handler, so this effect only writes after the RPC.
  useEffect(() => {
    const client = supabase;
    const name = form.username.trim();
    if (
      !client ||
      (phase !== "onboarding" && phase !== "editing") ||
      !isValidUsernameFormat(name) ||
      (profile && profile.username === name)
    ) {
      return;
    }
    const t = setTimeout(async () => {
      const { data, error } = await client.rpc("username_available", {
        candidate: name,
      });
      if (!error) setNameTaken(data === false);
    }, 500);
    return () => clearTimeout(t);
  }, [form.username, phase, profile]);

  const set = <K extends keyof ProfileFormState>(k: K, v: ProfileFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const sendLink = async () => {
    if (!supabase) return;
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setEmail(clean);
      setPhase("link-sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the link.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setForm(emptyForm());
    setLinkedWallet(null);
    setPhase("signed-out");
  };

  const save = async () => {
    if (!supabase || !user) return;
    setError(null);
    const errs = validateProfileForm(form, { requireTerms: phase === "onboarding" });
    if (nameTaken) errs.username = "That username is taken — try another.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      const username = form.username.trim();
      const { data: available, error: rpcError } = await supabase.rpc(
        "username_available",
        { candidate: username }
      );
      if (rpcError) throw rpcError;
      if (available === false && (!profile || profile.username !== username)) {
        setErrors({ username: "That username was just taken — try another." });
        return;
      }

      const marketingNow = form.marketingOptIn;
      const marketingWas = profile?.marketing_opt_in ?? false;
      const row = {
        id: user.id,
        email: user.email ?? "",
        username,
        user_type: form.userType,
        business_name: form.userType === "business" ? form.businessName.trim() : null,
        business_city: form.userType === "business" ? form.businessCity.trim() : null,
        business_state: form.userType === "business" ? form.businessState.trim() : null,
        freelance_work:
          form.userType === "freelancer" ? form.freelanceWork.trim() : null,
        wallet_address: linkedWallet,
        marketing_opt_in: marketingNow,
        marketing_consented_at:
          marketingNow && !marketingWas
            ? new Date().toISOString()
            : marketingNow
              ? (profile?.marketing_consented_at ?? new Date().toISOString())
              : null,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      };

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "id" });
      if (upsertError) throw upsertError;
      await loadProfile(user.id);
      setPhase("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const removeProfile = async () => {
    if (!supabase || !user) return;
    const ok = await confirm({
      title: "Delete your Mohar profile?",
      message: (
        <>
          Your escrows on Solana are unaffected, but your username and
          details here will be gone. You'll be signed out.
        </>
      ),
      confirmLabel: "Delete profile",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", user.id);
      if (error) throw error;
      // Full clean slate: DB row is gone, so also end the sign-in session
      // and disconnect the wallet — no user data should remain visible.
      deletedRef.current = true;
      await supabase.auth.signOut();
      try {
        await disconnect();
      } catch {
        // Wallet already disconnected or doesn't support it; not fatal.
      }
      setUser(null);
      setProfile(null);
      setForm(emptyForm());
      setEmail("");
      setLinkedWallet(null);
      setPhase("deleted");
    } catch (e) {
      deletedRef.current = false;
      setError(e instanceof Error ? e.message : "Couldn't delete your profile.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    if (!user?.email) return;
    setForm((f) => ({ ...f, username: suggestUsername(user.email ?? "") }));
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="page">
        <h1>Profile</h1>
        <div className="notice notice-warn">
          Profiles aren't connected yet — the app is missing its Supabase
          configuration. Check back soon.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Your profile</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        One profile for Mohar. Your email is verified with a sign-in link —
        no passwords, no OTP codes. Your wallet stays in your control; linking
        it here just ties it to your username.
      </p>

      {error && <div className="notice notice-error">{error}</div>}

      {phase === "loading" && <p className="muted">Loading…</p>}

      {phase === "signed-out" && (
        <div className="form">
          <div className="field">
            <label htmlFor="profile-email">Email address</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <div className="hint">
              We'll email you a sign-in link. Clicking it verifies your email.
            </div>
          </div>
          <div>
            <button className="btn btn-primary" onClick={sendLink} disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </div>
        </div>
      )}

      {phase === "link-sent" && (
        <div className="form">
          <div className="notice notice-ok">
            Sign-in link sent to <strong>{email}</strong>. Click the link in
            that email to continue — it verifies your address at the same time.
          </div>
          <div className="notice notice-warn">
            Open the link on <strong>this device, in this browser</strong>.
            It won't work if you open it somewhere else (for example, on
            your phone after requesting it on your laptop).
          </div>
          <div>
            <button className="btn btn-ghost" onClick={() => setPhase("signed-out")}>
              Use a different email
            </button>
          </div>
        </div>
      )}

      {(phase === "onboarding" || phase === "editing" || phase === "saved") && (
        <div className="form">
          {phase === "saved" && (
            <div className="notice notice-ok">Profile saved.</div>
          )}

          <div className="field">
            <label>Email (verified)</label>
            <input type="email" value={user?.email ?? ""} disabled readOnly />
          </div>

          <div className="field">
            <label htmlFor="profile-username">Username</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="profile-username"
                value={form.username}
                onChange={(e) => {
                  set(
                    "username",
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  );
                  setNameTaken(null);
                }}
                placeholder="e.g. ram_4821"
                maxLength={20}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  regenerate();
                  setNameTaken(null);
                }}
              >
                Suggest
              </button>
            </div>
            {nameTaken === true && (
              <div className="error">That username is taken.</div>
            )}
            {nameTaken === false && (
              <div className="hint" style={{ color: "var(--success)" }}>
                Username is available.
              </div>
            )}
            {errors.username && <div className="error">{errors.username}</div>}
            {!errors.username && nameTaken === null && (
              <div className="hint">
                3-20 characters: lowercase letters, numbers, underscores. No
                real names needed.
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="profile-usertype">I am a…</label>
            <select
              id="profile-usertype"
              value={form.userType}
              onChange={(e) =>
                set("userType", e.target.value as ProfileFormState["userType"])
              }
            >
              <option value="">Choose one…</option>
              {USER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.hint}
                </option>
              ))}
            </select>
            {errors.userType && <div className="error">{errors.userType}</div>}
          </div>

          {form.userType === "business" && (
            <>
              <div className="field">
                <label htmlFor="profile-bizname">Business name</label>
                <input
                  id="profile-bizname"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                  maxLength={120}
                />
                {errors.businessName && (
                  <div className="error">{errors.businessName}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="profile-city">City</label>
                  <input
                    id="profile-city"
                    value={form.businessCity}
                    onChange={(e) => set("businessCity", e.target.value)}
                    maxLength={80}
                  />
                  {errors.businessCity && (
                    <div className="error">{errors.businessCity}</div>
                  )}
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="profile-state">State</label>
                  <input
                    id="profile-state"
                    value={form.businessState}
                    onChange={(e) => set("businessState", e.target.value)}
                    maxLength={80}
                  />
                  {errors.businessState && (
                    <div className="error">{errors.businessState}</div>
                  )}
                </div>
              </div>
            </>
          )}

          {form.userType === "freelancer" && (
            <div className="field">
              <label htmlFor="profile-work">What kind of freelance work do you do?</label>
              <input
                id="profile-work"
                value={form.freelanceWork}
                onChange={(e) => set("freelanceWork", e.target.value)}
                placeholder="e.g. logo design, video editing, web development"
                maxLength={160}
              />
              {errors.freelanceWork && (
                <div className="error">{errors.freelanceWork}</div>
              )}
            </div>
          )}

          <div className="field">
            <label>Linked wallet</label>
            {linkedWallet ? (
              <div className="notice notice-info" style={{ margin: 0 }}>
                <code style={{ fontSize: 13 }}>{linkedWallet}</code>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLinkedWallet(null)}
                  >
                    Unlink
                  </button>
                </div>
              </div>
            ) : connected && publicKey ? (
              <div>
                <div className="hint" style={{ marginBottom: 8 }}>
                  Connected:{" "}
                  <code style={{ fontSize: 13 }}>
                    {publicKey.toBase58().slice(0, 8)}…
                    {publicKey.toBase58().slice(-8)}
                  </code>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setLinkedWallet(publicKey.toBase58())}
                >
                  Link this wallet
                </button>
              </div>
            ) : (
              <div className="hint">
                Connect a wallet (top right) to link it to your profile.
                Optional.
              </div>
            )}
          </div>

          <div className="field">
            <label
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <input
                type="checkbox"
                checked={form.marketingOptIn}
                onChange={(e) => set("marketingOptIn", e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2 }}
              />
              <span>
                Email me about Mohar updates and opportunities.
                <div className="hint">
                  Optional. You can change this anytime. Accepting the Terms
                  below does not subscribe you to marketing.
                </div>
              </span>
            </label>
          </div>

          {phase === "onboarding" && (
            <div className="field">
              <label
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <input
                  type="checkbox"
                  checked={form.acceptedTerms}
                  onChange={(e) => set("acceptedTerms", e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2 }}
                />
                <span>
                  I accept the{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      go({ name: "terms" });
                    }}
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      go({ name: "privacy" });
                    }}
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {errors.acceptedTerms && (
                <div className="error">{errors.acceptedTerms}</div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={busy}
            >
              {busy
                ? "Saving…"
                : phase === "onboarding"
                  ? "Create profile"
                  : "Save changes"}
            </button>
            <button className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>

          {phase === "editing" && (
            <div style={{ marginTop: 24 }}>
              <button
                className="btn btn-danger"
                onClick={removeProfile}
                disabled={busy}
              >
                Delete my profile
              </button>
              <div className="hint" style={{ marginTop: 8 }}>
                Removes your profile from Mohar. Escrows on Solana are
                unaffected. To also delete your sign-in account, contact us as
                described in the Privacy Policy.
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "deleted" && (
        <div className="form">
          <div className="notice notice-ok">
            Your profile has been deleted and you've been signed out. No
            profile data remains.
          </div>
          <div>
            <button
              className="btn btn-primary"
              onClick={() => {
                deletedRef.current = false;
                setForm(emptyForm());
                setPhase("signed-out");
              }}
            >
              Create a new profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
