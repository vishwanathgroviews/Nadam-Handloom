/**
 * The bottom-tab routes. Home, Orders, Scanner, Products and Profile live
 * ONLY inside the tab navigator — they are deliberately not also registered
 * as siblings in the outer AppStack. Registering them twice used to mean a
 * screen could be reached either as a tab (with the tab bar, no back button)
 * or as a pushed stack route (no tab bar, no back button either), so the
 * only way off the pushed copy was the hardware back key, which unwound
 * straight past it to Home.
 */
export type RootTabName = 'HomeTab' | 'OrdersTab' | 'ScannerTab' | 'ProductsTab' | 'ProfileTab';

/**
 * Jumps to one of the app's five top-level destinations. These are roots,
 * not steps in a journey: selecting one unwinds whatever stack you were in
 * back to the tab container rather than piling another copy on top of it.
 */
export const goToTab = (
  // Deliberately loose: this is called from screens typed against the stack
  // and from screens typed against the tab navigator, and the action bubbles
  // to whichever ancestor owns the 'Home' route in either case.
  navigation: { navigate: (...args: any[]) => void },
  tab: RootTabName,
  params?: Record<string, unknown>
) => {
  navigation.navigate('Home', { screen: tab, ...(params ? { params } : {}) });
};
