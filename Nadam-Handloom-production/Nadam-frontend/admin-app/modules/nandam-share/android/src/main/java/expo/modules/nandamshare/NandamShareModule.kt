package expo.modules.nandamshare

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Sends a file from the app's cache to a customer (Module 3: catalogue PDF; Module 6: invoices).
//   whatsAppPackage(): "com.whatsapp.w4b" (WhatsApp Business), "com.whatsapp", or null.
//   shareToWhatsApp(): opens that customer's chat with the file and caption attached; the
//     person presses Send. The number is used for this one share and never stored.
//   shareFile(): the phone's share menu, with the caption.
class NandamShareModule : Module() {
  private val context get() = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "The app isn't ready yet.", null)

  private fun installed(pkg: String): Boolean = try {
    context.packageManager.getPackageInfo(pkg, 0); true
  } catch (_: PackageManager.NameNotFoundException) { false }

  private fun whatsApp(): String? = listOf("com.whatsapp.w4b", "com.whatsapp").firstOrNull { installed(it) }

  private fun uriFor(path: String): Uri {
    val file = File(Uri.parse(path).path ?: path)
    if (!file.exists()) throw CodedException("FILE_MISSING", "The file is no longer on this phone. Please try again.", null)
    return FileProvider.getUriForFile(context, "${context.packageName}.nandamshare", file)
  }

  private fun start(intent: Intent) {
    val activity = appContext.currentActivity ?: throw CodedException("NO_ACTIVITY", "Open the app and try again.", null)
    activity.startActivity(intent)
  }

  override fun definition() = ModuleDefinition {
    Name("NandamShare")

    Function("whatsAppPackage") { whatsApp() }

    AsyncFunction("shareToWhatsApp") { path: String, mimeType: String, mobile: String, caption: String ->
      val pkg = whatsApp() ?: throw CodedException("NO_WHATSAPP", "WhatsApp isn't installed on this phone.", null)
      val digits = mobile.filter { it.isDigit() }.takeLast(10)
      if (digits.length != 10) throw CodedException("BAD_NUMBER", "Enter the customer's 10-digit mobile number.", null)
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        setPackage(pkg)
        putExtra(Intent.EXTRA_STREAM, uriFor(path))
        putExtra(Intent.EXTRA_TEXT, caption)
        putExtra("jid", "91$digits@s.whatsapp.net")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      start(intent)
    }

    AsyncFunction("shareFile") { path: String, mimeType: String, caption: String, title: String ->
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uriFor(path))
        putExtra(Intent.EXTRA_TEXT, caption)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      start(Intent.createChooser(send, title).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
  }
}
