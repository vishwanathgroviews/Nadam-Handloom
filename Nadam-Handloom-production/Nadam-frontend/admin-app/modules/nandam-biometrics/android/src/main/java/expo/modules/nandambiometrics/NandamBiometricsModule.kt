package expo.modules.nandambiometrics

import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.atomic.AtomicBoolean

// Fingerprint sign-in keys (docs/modules/module-01-sign-in.md, section 8.3).
//
// The private key lives in the Android Keystore (StrongBox when the phone has it):
//   - it cannot be exported;
//   - every use needs a STRONG (Class 3) biometric check through BiometricPrompt;
//   - it is invalidated when fingerprints are added or removed.
// Weak face unlock (Class 2) cannot unlock it, so it is never offered.
class NandamBiometricsModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("NandamBiometrics")

    // { available, type: fingerprint | face | iris | none, reason?, secureHardware, strongBox }
    AsyncFunction("getStatus") { status() }

    AsyncFunction("createKey") { alias: String, promise: Promise -> createKey(keyAlias(alias), promise) }

    AsyncFunction("hasKey") { alias: String -> keyStore().containsAlias(keyAlias(alias)) }

    AsyncFunction("deleteKey") { alias: String -> deleteKey(keyAlias(alias)) }

    AsyncFunction("sign") { alias: String, payload: String, title: String, subtitle: String, cancelText: String, promise: Promise ->
      sign(keyAlias(alias), payload, title, subtitle, cancelText, promise)
    }
  }

  private fun keyAlias(alias: String) = "com.nandamhandlooms.biometric.$alias"

  private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun hasStrongBox(): Boolean =
    Build.VERSION.SDK_INT >= 28 && context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)

  private fun status(): Map<String, Any?> {
    val pm = context.packageManager
    val result = BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG)
    val type = when {
      pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT) -> "fingerprint"
      Build.VERSION.SDK_INT >= 29 && pm.hasSystemFeature(PackageManager.FEATURE_FACE) -> "face"
      Build.VERSION.SDK_INT >= 29 && pm.hasSystemFeature(PackageManager.FEATURE_IRIS) -> "iris"
      else -> "none"
    }
    val reason = when (result) {
      BiometricManager.BIOMETRIC_SUCCESS -> null
      BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "NOT_ENROLLED"
      BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "SECURITY_UPDATE_REQUIRED"
      else -> "NOT_AVAILABLE"
    }
    return mapOf(
      "available" to (result == BiometricManager.BIOMETRIC_SUCCESS),
      "type" to type,
      "reason" to reason,
      "secureHardware" to true,
      "strongBox" to hasStrongBox(),
    )
  }

  private fun createKey(alias: String, promise: Promise) {
    try {
      deleteKey(alias)
      val publicKey = try {
        generate(alias, hasStrongBox())
      } catch (e: Exception) {
        if (!hasStrongBox()) throw e
        generate(alias, false) // StrongBox refused this key type or is busy: use the regular secure Keystore
      }
      promise.resolve(Base64.encodeToString(publicKey, Base64.NO_WRAP))
    } catch (e: Exception) {
      deleteKey(alias)
      promise.reject("KEY_CREATE_FAILED", "This device could not create a secure key (${e.message}).", e)
    }
  }

  private fun generate(alias: String, strongBox: Boolean): ByteArray {
    val builder = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setUserAuthenticationRequired(true)
      .setInvalidatedByBiometricEnrollment(true)
    if (Build.VERSION.SDK_INT >= 30) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    } else {
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(-1)
    }
    if (strongBox && Build.VERSION.SDK_INT >= 28) builder.setIsStrongBoxBacked(true)
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
    generator.initialize(builder.build())
    return generator.generateKeyPair().public.encoded // X.509 SubjectPublicKeyInfo (DER)
  }

  private fun sign(alias: String, payload: String, title: String, subtitle: String, cancelText: String, promise: Promise) {
    val activity = appContext.currentActivity as? FragmentActivity
      ?: return promise.reject("NO_ACTIVITY", "The app is not in the foreground.", null)
    val privateKey = try {
      keyStore().getKey(alias, null) as? PrivateKey
    } catch (e: Exception) {
      null
    } ?: return promise.reject("KEY_NOT_FOUND", "Fingerprint sign-in isn't set up on this phone for this account.", null)

    val signature = Signature.getInstance("SHA256withECDSA")
    try {
      signature.initSign(privateKey)
    } catch (e: KeyPermanentlyInvalidatedException) {
      deleteKey(alias)
      return promise.reject("INVALIDATED", "Fingerprint sign-in was turned off because this phone's fingerprints changed. Sign in with your PIN to turn it on again.", e)
    } catch (e: Exception) {
      return promise.reject("FAILED", "Could not start fingerprint sign-in (${e.message}).", e)
    }

    val settled = AtomicBoolean(false)
    fun settle(block: () -> Unit) {
      if (settled.compareAndSet(false, true)) block()
    }

    activity.runOnUiThread {
      val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          settle {
            try {
              val unlocked = result.cryptoObject?.signature ?: throw IllegalStateException("No signature object")
              unlocked.update(payload.toByteArray(Charsets.UTF_8))
              promise.resolve(Base64.encodeToString(unlocked.sign(), Base64.NO_WRAP))
            } catch (e: Exception) {
              promise.reject("FAILED", "Could not sign the sign-in challenge (${e.message}).", e)
            }
          }
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          val code = when (errorCode) {
            BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "FALLBACK"
            BiometricPrompt.ERROR_USER_CANCELED, BiometricPrompt.ERROR_CANCELED -> "CANCELLED"
            BiometricPrompt.ERROR_LOCKOUT, BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "LOCKOUT"
            BiometricPrompt.ERROR_NO_BIOMETRICS -> "NOT_ENROLLED"
            BiometricPrompt.ERROR_HW_NOT_PRESENT, BiometricPrompt.ERROR_HW_UNAVAILABLE -> "NOT_AVAILABLE"
            else -> "FAILED"
          }
          settle { promise.reject(code, errString.toString(), null) }
        }
        // onAuthenticationFailed = one unrecognised finger; the prompt stays open for another try.
      })
      val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setNegativeButtonText(cancelText)
        .setAllowedAuthenticators(BIOMETRIC_STRONG)
        .setConfirmationRequired(false)
        .build()
      prompt.authenticate(info, BiometricPrompt.CryptoObject(signature))
    }
  }

  private fun deleteKey(alias: String) {
    try {
      keyStore().deleteEntry(alias)
    } catch (_: Exception) {
    }
  }
}
