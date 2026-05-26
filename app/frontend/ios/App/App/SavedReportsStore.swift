import Foundation

/// Reads the offline-saved reports written by the JS layer via
/// @capacitor/preferences. Capacitor stores values in NSUserDefaults under
/// keys prefixed with `CapacitorStorage.`, so we can pull them out from
/// native Swift without going through the web layer.
///
/// This is what powers the native SwiftUI Home tab's "Recent Reports" list —
/// genuinely native UI driven by data the user has already saved on-device.
struct SavedReport: Identifiable, Hashable {
    let id: String
    let address: String
    let savedAt: Date
    let reportUrl: String?
}

enum SavedReportsStore {
    private static let key = "CapacitorStorage.pdna_saved_reports_v1"

    static func load() -> [SavedReport] {
        guard let raw = UserDefaults.standard.string(forKey: key),
              let data = raw.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return arr.compactMap { d in
            guard let id = d["id"] as? String, let address = d["address"] as? String else { return nil }
            let savedAt = (d["savedAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000.0) } ?? Date()
            return SavedReport(id: id, address: address, savedAt: savedAt, reportUrl: d["reportUrl"] as? String)
        }
    }
}
