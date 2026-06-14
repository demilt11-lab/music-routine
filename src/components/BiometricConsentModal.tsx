import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Heart, Lock } from "lucide-react";

interface BiometricConsentModalProps {
  userId: string;
  onConsented: () => void;
  onDeclined: () => void;
}

export function BiometricConsentModal({
  userId, onConsented, onDeclined,
}: BiometricConsentModalProps) {
  const [checked, setChecked]   = useState({ biometric: false, processing: false, healthkit: false });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const allChecked = checked.biometric && checked.processing;

  async function handleConsent() {
    if (!allChecked) return;
    setLoading(true);
    setError(null);
    try {
      const { error: rpcErr } = await (supabase as any).rpc("grant_biometric_consent", {
        p_user_id: userId,
        p_version: "1.0",
        p_ip_hash: null, // server-side hashing via edge function
      });
      if (rpcErr) throw rpcErr;
      onConsented();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record consent. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-w-lg rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
            <Heart className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Health Data Consent
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Required before your first session</p>
          </div>
        </div>

        {/* What we collect */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            FLOWSTATE will collect:
          </p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
              Heart rate, HRV, blood oxygen, respiratory rate
            </li>
            <li className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
              EEG brainwave data (if EEG device connected)
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
              Stress, activity intensity, motion data
            </li>
          </ul>
        </div>

        {/* Legal guarantees */}
        <div className="mb-6 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>✓ All data encrypted at rest (AES-256) and in transit (TLS 1.3)</p>
          <p>✓ Never used for advertising or sold to third parties</p>
          <p>✓ Retained for maximum 2 years, then aggregated</p>
          <p>✓ Full export and deletion available at any time (GDPR/CCPA)</p>
          <p>✓ HealthKit data never shared without your explicit consent</p>
        </div>

        {/* Consent checkboxes */}
        <div className="mb-6 space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={checked.biometric}
              onCheckedChange={(v) => setChecked((c) => ({ ...c, biometric: Boolean(v) }))}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I consent to FLOWSTATE collecting and processing my biometric health data
              for the purpose of personalizing my music experience. <span className="font-medium">Required.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={checked.processing}
              onCheckedChange={(v) => setChecked((c) => ({ ...c, processing: Boolean(v) }))}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I have read and agree to the{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                 className="text-teal-600 underline hover:text-teal-700">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer"
                 className="text-teal-600 underline hover:text-teal-700">
                Terms of Service
              </a>. <span className="font-medium">Required.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={checked.healthkit}
              onCheckedChange={(v) => setChecked((c) => ({ ...c, healthkit: Boolean(v) }))}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              I consent to FLOWSTATE accessing Apple HealthKit data on this device. Optional.
            </span>
          </label>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDeclined}
            disabled={loading}
          >
            Decline
          </Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700"
            onClick={handleConsent}
            disabled={!allChecked || loading}
          >
            {loading ? "Saving…" : "I Consent — Continue"}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          You can withdraw consent and delete all your data at any time in Settings.
        </p>
      </div>
    </div>
  );
}
