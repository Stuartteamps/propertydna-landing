import AppIntents
import UIKit

/// PropertyDNA's iOS App Intents — declarations Siri and the Shortcuts app
/// pick up automatically via the AppIntents framework (iOS 16+). They allow
/// voice-driven control: "Hey Siri, analyze a property with PropertyDNA",
/// "Hey Siri, show my saved PropertyDNA reports".
///
/// Each intent opens the app to the relevant deep link. The web layer is
/// completely uninvolved — Siri talks directly to Swift, then hands off to
/// the bridge view controller which navigates the web layer via URL.

@available(iOS 16.0, *)
struct AnalyzePropertyIntent: AppIntent {
    static var title: LocalizedStringResource = "Analyze a Property"
    static var description = IntentDescription("Open the PropertyDNA Analyze form to generate an intelligence report on any U.S. property.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        await openDeepLink(path: "/analyze")
        return .result()
    }
}

@available(iOS 16.0, *)
struct ViewSavedReportsIntent: AppIntent {
    static var title: LocalizedStringResource = "View Saved Reports"
    static var description = IntentDescription("Open offline-saved PropertyDNA reports stored on this device.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        await openDeepLink(path: "/saved-reports")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenDashboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Open PropertyDNA Dashboard"
    static var description = IntentDescription("Open your PropertyDNA account dashboard.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        await openDeepLink(path: "/dashboard")
        return .result()
    }
}

@available(iOS 16.0, *)
struct ShowMarketHeatmapIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Market Heat Map"
    static var description = IntentDescription("Open the live PropertyDNA market heat map.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        await openDeepLink(path: "/market-heatmaps")
        return .result()
    }
}

@MainActor
private func openDeepLink(path: String) async {
    let urlString = "https://thepropertydna.com\(path)"
    guard let url = URL(string: urlString) else { return }
    UIApplication.shared.open(url, options: [:], completionHandler: nil)
}

@available(iOS 16.0, *)
struct PropertyDNAShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AnalyzePropertyIntent(),
            phrases: [
                "Analyze a property with \(.applicationName)",
                "Run a property report in \(.applicationName)",
                "\(.applicationName) analyze property"
            ],
            shortTitle: "Analyze Property",
            systemImageName: "house.and.flag"
        )
        AppShortcut(
            intent: ViewSavedReportsIntent(),
            phrases: [
                "Show my saved \(.applicationName) reports",
                "Open saved reports in \(.applicationName)"
            ],
            shortTitle: "Saved Reports",
            systemImageName: "bookmark"
        )
        AppShortcut(
            intent: OpenDashboardIntent(),
            phrases: [
                "Open my \(.applicationName) dashboard",
                "Show \(.applicationName) account"
            ],
            shortTitle: "Dashboard",
            systemImageName: "person.circle"
        )
        AppShortcut(
            intent: ShowMarketHeatmapIntent(),
            phrases: [
                "Show \(.applicationName) heat map",
                "Open market heat map in \(.applicationName)"
            ],
            shortTitle: "Heat Map",
            systemImageName: "map"
        )
    }
}

/// Donates a likely-next-action shortcut after launch so iOS learns the
/// flow and Siri can suggest it on the lock screen / in search.
enum AppShortcutManager {
    static func donateOnLaunch() {
        if #available(iOS 16.0, *) {
            PropertyDNAShortcuts.updateAppShortcutParameters()
        }
    }
}
