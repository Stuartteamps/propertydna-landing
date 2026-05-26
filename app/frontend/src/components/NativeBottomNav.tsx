// Deprecated as of Build 12: the iOS app now has a real native
// UITabBarController as its root, so this JS-rendered faux tab bar is
// no longer needed. We keep the component as a no-op export to avoid a
// big-bang removal across every page that imports it.

export default function NativeBottomNav() {
  return null;
}
