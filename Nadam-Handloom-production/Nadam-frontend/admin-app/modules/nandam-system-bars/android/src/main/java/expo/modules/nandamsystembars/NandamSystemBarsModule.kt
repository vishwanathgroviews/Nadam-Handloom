package expo.modules.nandamsystembars

import android.os.Build
import android.view.WindowInsetsController
import androidx.core.view.WindowCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android's own button strip (back, home, recent) follows light/dark, also when the phone
// switches while the app is open. React Native sets it only once, at start; the
// expo-navigation-bar library's call didn't change it after start on the test phone
// (Samsung, Android 12), this one does (checked 2026-10-12).
//   setNavigationBarLight(true): light strip with dark buttons; false: dark strip.
class NandamSystemBarsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NandamSystemBars")

    AsyncFunction("setNavigationBarLight") { light: Boolean ->
      val window = appContext.currentActivity?.window ?: return@AsyncFunction
      WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = light
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val mask = WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        window.decorView.windowInsetsController?.setSystemBarsAppearance(if (light) mask else 0, mask)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
