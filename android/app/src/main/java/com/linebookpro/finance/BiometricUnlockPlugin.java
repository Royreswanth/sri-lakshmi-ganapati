package com.linebookpro.finance;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "BiometricUnlock")
public class BiometricUnlockPlugin extends Plugin {

    private static final int ALLOWED_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG |
        BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        int canAuth = manager.canAuthenticate(ALLOWED_AUTHENTICATORS);

        JSObject ret = new JSObject();
        if (canAuth == BiometricManager.BIOMETRIC_SUCCESS) {
            ret.put("available", true);
            ret.put("status", "AVAILABLE");
        } else if (canAuth == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            ret.put("available", false);
            ret.put("status", "NONE_ENROLLED");
        } else if (
            canAuth == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ||
            canAuth == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE
        ) {
            ret.put("available", false);
            ret.put("status", "NOT_AVAILABLE");
        } else {
            ret.put("available", false);
            ret.put("status", "UNAVAILABLE");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        AppCompatActivity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("Activity unavailable", "UNAVAILABLE");
            return;
        }

        BiometricManager manager = BiometricManager.from(getContext());
        int canAuth = manager.canAuthenticate(ALLOWED_AUTHENTICATORS);
        if (canAuth == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            call.reject("No fingerprint or biometric enrolled in phone settings", "NONE_ENROLLED");
            return;
        }
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Biometric hardware unavailable", "NOT_AVAILABLE");
            return;
        }

        String rawTitle = call.getString("title", "LineBook Pro Unlock");
        String rawSubtitle = call.getString("subtitle", "Touch fingerprint sensor to unlock");
        String rawNegative = call.getString("negativeButtonText", "Use 4-Digit PIN");

        final String title = (rawTitle != null && !rawTitle.trim().isEmpty()) ? rawTitle.trim() : "LineBook Pro Unlock";
        final String subtitle = (rawSubtitle != null && !rawSubtitle.trim().isEmpty()) ? rawSubtitle.trim() : "Touch fingerprint sensor to unlock";
        final String negativeText = (rawNegative != null && !rawNegative.trim().isEmpty()) ? rawNegative.trim() : "Use 4-Digit PIN";

        activity.runOnUiThread(() -> {
            final AtomicBoolean settled = new AtomicBoolean(false);
            Executor executor = ContextCompat.getMainExecutor(activity);

            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        if (!settled.compareAndSet(false, true)) return;

                        if (
                            errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                            errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            errorCode == BiometricPrompt.ERROR_CANCELED
                        ) {
                            call.reject("Biometric verification cancelled", "USER_CANCELLED");
                        } else if (
                            errorCode == BiometricPrompt.ERROR_LOCKOUT ||
                            errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT
                        ) {
                            call.reject("Too many failed attempts. Use 4-digit PIN.", "LOCKOUT");
                        } else if (errorCode == BiometricPrompt.ERROR_NO_BIOMETRICS) {
                            call.reject("No biometric enrolled", "NONE_ENROLLED");
                        } else if (errorCode == BiometricPrompt.ERROR_HW_NOT_PRESENT || errorCode == BiometricPrompt.ERROR_HW_UNAVAILABLE) {
                            call.reject("Biometric hardware unavailable", "NOT_AVAILABLE");
                        } else {
                            call.reject(errString.toString(), "AUTH_FAILED");
                        }
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        if (!settled.compareAndSet(false, true)) return;
                        JSObject ret = new JSObject();
                        ret.put("verified", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // Do not reject immediately; Android BiometricPrompt lets the user retry.
                    }
                }
            );

            try {
                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                    .setNegativeButtonText(negativeText)
                    .setConfirmationRequired(false)
                    .build();
                prompt.authenticate(promptInfo);
            } catch (Exception ex) {
                if (settled.compareAndSet(false, true)) {
                    call.reject(ex.getMessage() != null ? ex.getMessage() : "Biometric prompt failed", "AUTH_FAILED");
                }
            }
        });
    }
}
