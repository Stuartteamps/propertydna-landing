import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase — must be first
        FirebaseApp.configure()

        // Programmatically install the native UITabBarController as the root
        // view controller. This is the structural fix for Apple Guideline 4.2:
        // the first thing the system shows is a real iOS tab bar with native
        // SwiftUI/UIKit screens, not a WKWebView.
        let window = UIWindow(frame: UIScreen.main.bounds)
        let root = NativeRootTabBarController()
        window.rootViewController = root
        window.makeKeyAndVisible()
        self.window = window

        // If launched via a Quick Action, stash it for the bridge to consume
        // once the web layer is ready.
        if let item = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            _ = QuickActionsHandler.handle(item)
        }
        return true
    }

    /// Quick Actions (Home Screen long-press menu) — iOS calls this when the
    /// user taps one of the items declared in Info.plist's
    /// UIApplicationShortcutItems. We forward to QuickActionsHandler which
    /// navigates the bridge view's web layer.
    func application(_ application: UIApplication,
                     performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        completionHandler(QuickActionsHandler.handle(shortcutItem))
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    // Handle URL schemes (Google Sign In, deep links)
    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    // Handle Universal Links
    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application,
                                                           continue: userActivity,
                                                           restorationHandler: restorationHandler)
    }

    // Push notification registration
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
