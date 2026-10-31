import CryptoKit
import ExpoModulesCore
import LocalAuthentication
import Security

// Face ID / Touch ID sign-in keys (docs/modules/module-01-sign-in.md, section 8.3).
//
// The private key is created inside the Secure Enclave with the access control
// [.privateKeyUsage, .biometryCurrentSet]. That means:
//   - it never leaves the chip and cannot be exported or backed up;
//   - it can sign only right after a successful Face ID / Touch ID check;
//   - it stops working for good if faces or fingers are added or removed.
// The server keeps the public key and checks signatures over one-time challenges.
public class NandamBiometricsModule: Module {
  // DER header that turns a raw P-256 public key (04 || X || Y) into SubjectPublicKeyInfo.
  private static let spkiHeader: [UInt8] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
  ]

  public func definition() -> ModuleDefinition {
    Name("NandamBiometrics")

    // { available, type: faceId | touchId | opticId | none, reason?, secureHardware }
    AsyncFunction("getStatus") { () -> [String: Any] in
      return Self.status()
    }

    // Creates (or replaces) the key and returns its public key as base64 SPKI.
    AsyncFunction("createKey") { (alias: String, promise: Promise) in
      Self.createKey(alias: alias, promise: promise)
    }

    AsyncFunction("hasKey") { (alias: String) -> Bool in
      return Self.findKey(alias: alias, context: nil) != nil
    }

    AsyncFunction("deleteKey") { (alias: String) in
      Self.deleteKey(alias: alias)
    }

    // Shows Face ID / Touch ID, then signs `payload` (UTF-8) and returns the DER signature as base64.
    AsyncFunction("sign") { (alias: String, payload: String, reason: String, fallbackTitle: String, promise: Promise) in
      Self.sign(alias: alias, payload: payload, reason: reason, fallbackTitle: fallbackTitle, promise: promise)
    }
  }

  private static func tag(_ alias: String) -> Data {
    return Data("com.nandamhandlooms.biometric.\(alias)".utf8)
  }

  static func status() -> [String: Any] {
    let context = LAContext()
    var error: NSError?
    let canUse = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    var type = "none"
    let biometry = context.biometryType
    if biometry == .faceID {
      type = "faceId"
    } else if biometry == .touchID {
      type = "touchId"
    } else if #available(iOS 17.0, *), biometry == .opticID {
      type = "opticId"
    }
    var result: [String: Any] = [
      "available": canUse && SecureEnclave.isAvailable,
      "type": type,
      "secureHardware": SecureEnclave.isAvailable,
    ]
    if !canUse { result["reason"] = code(for: error) }
    else if !SecureEnclave.isAvailable { result["reason"] = "NOT_AVAILABLE" }
    return result
  }

  static func createKey(alias: String, promise: Promise) {
    deleteKey(alias: alias)
    var error: Unmanaged<CFError>?
    guard let access = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
      [.privateKeyUsage, .biometryCurrentSet],
      &error
    ) else {
      promise.reject("KEY_CREATE_FAILED", "Could not set up the key protection on this device.")
      return
    }
    let attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeySizeInBits as String: 256,
      kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: tag(alias),
        kSecAttrAccessControl as String: access,
      ] as [String: Any],
    ]
    guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
      let detail = error?.takeRetainedValue().localizedDescription ?? "unknown error"
      promise.reject("KEY_CREATE_FAILED", "This device could not create a secure key (\(detail)).")
      return
    }
    guard let publicKey = SecKeyCopyPublicKey(privateKey),
          let raw = SecKeyCopyExternalRepresentation(publicKey, &error) as Data?,
          raw.count == 65
    else {
      deleteKey(alias: alias)
      promise.reject("KEY_CREATE_FAILED", "Could not read the new public key.")
      return
    }
    promise.resolve((Data(spkiHeader) + raw).base64EncodedString())
  }

  static func findKey(alias: String, context: LAContext?) -> SecKey? {
    var query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: tag(alias),
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecReturnRef as String: true,
    ]
    if let context = context {
      query[kSecUseAuthenticationContext as String] = context
    }
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let found = item else {
      return nil
    }
    return (found as! SecKey)
  }

  static func deleteKey(alias: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: tag(alias),
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
    ]
    SecItemDelete(query as CFDictionary)
  }

  static func sign(alias: String, payload: String, reason: String, fallbackTitle: String, promise: Promise) {
    guard findKey(alias: alias, context: nil) != nil else {
      promise.reject("KEY_NOT_FOUND", "Face ID isn't set up on this phone for this account.")
      return
    }
    let context = LAContext()
    context.localizedFallbackTitle = fallbackTitle // shown after an unrecognised try, e.g. "Use PIN"
    var canError: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &canError) else {
      promise.reject(code(for: canError), message(for: code(for: canError)))
      return
    }
    // One biometric check; the same evaluated context then unlocks the key without a second prompt.
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
      guard success else {
        let c = code(for: error as NSError?)
        promise.reject(c, message(for: c))
        return
      }
      guard let key = findKey(alias: alias, context: context) else {
        promise.reject("KEY_NOT_FOUND", "Face ID isn't set up on this phone for this account.")
        return
      }
      var signError: Unmanaged<CFError>?
      guard let signature = SecKeyCreateSignature(
        key, .ecdsaSignatureMessageX962SHA256, Data(payload.utf8) as CFData, &signError
      ) as Data? else {
        // The face check passed but the key refused: the enrolled faces or fingers
        // changed after the key was made (biometryCurrentSet).
        promise.reject("INVALIDATED", message(for: "INVALIDATED"))
        return
      }
      promise.resolve(signature.base64EncodedString())
    }
  }

  static func code(for error: NSError?) -> String {
    guard let error = error, error.domain == LAErrorDomain, let la = LAError.Code(rawValue: error.code) else {
      return "FAILED"
    }
    switch la {
    case .userCancel, .systemCancel, .appCancel: return "CANCELLED"
    case .userFallback: return "FALLBACK"
    case .biometryLockout: return "LOCKOUT"
    case .biometryNotEnrolled: return "NOT_ENROLLED"
    case .biometryNotAvailable, .passcodeNotSet: return "NOT_AVAILABLE"
    default: return "FAILED"
    }
  }

  static func message(for code: String) -> String {
    switch code {
    case "CANCELLED": return "Face ID was cancelled."
    case "FALLBACK": return "Use your PIN instead."
    case "LOCKOUT": return "Face ID is locked after too many tries. Unlock the phone with its passcode, or use your PIN."
    case "NOT_ENROLLED": return "Face ID isn't set up on this phone. Set it up in Settings, or use your PIN."
    case "NOT_AVAILABLE": return "Face ID isn't available on this phone."
    case "INVALIDATED": return "Face ID was turned off because this phone's face settings changed. Sign in with your PIN to turn it on again."
    default: return "Face ID didn't work. Use your PIN."
    }
  }
}
