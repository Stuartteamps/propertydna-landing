import UIKit
import Capacitor

/// Handles iOS Home Screen Quick Actions (long-press the app icon → native
/// iOS menu of common actions). The shortcut items themselves are declared
/// in Info.plist as UIApplicationShortcutItems. When the user picks one,
/// iOS calls AppDelegate.application(_:performActionFor:completionHandler:)
/// which forwards to this handler.
///
/// We resolve the shortcut to an in-app URL and either navigate the bridge
/// to that URL (if the app is already running) or stash it for use after
/// the bridge view loads (cold start).
enum QuickActionsHandler {

    private static var pendingURL: URL?

    static func handle(_ item: UIApplicationShortcutItem) -> Bool {
        let path: String
        switch item.type {
        case "com.thepropertydna.app.analyze":
            path = "/analyze"
        case "com.thepropertydna.app.saved":
            path = "/saved-reports"
        case "com.thepropertydna.app.dashboard":
            path = "/dashboard"
        case "com.thepropertydna.app.heatmap":
            path = "/market-heatmaps"
        default:
            return false
        }
        return navigate(to: path)
    }

    /// Resolve the deep-link target for an NSUserActivity payload (used by
    /// Core Spotlight tap-throughs and Siri intents that pass URLs).
    static func handle(_ url: URL) -> Bool {
        guard let path = url.path.isEmpty ? "/" : Optional(url.path) else { return false }
        return navigate(to: path)
    }

    private static func navigate(to path: String) -> Bool {
        if let root = NativeRootTabBarController.shared {
            root.openWebPath(path)
            return true
        }
        // Cold start: root not ready yet. Park it; viewDidLoad on the root
        // tab bar reads `consumePending()` on appear.
        pendingURL = URL(string: "https://thepropertydna.com\(path)")
        return true
    }

    static func consumePending() -> URL? {
        let u = pendingURL
        pendingURL = nil
        return u
    }
}
