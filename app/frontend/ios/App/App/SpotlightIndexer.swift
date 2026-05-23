import Foundation
import CoreSpotlight
import UniformTypeIdentifiers
import WebKit

/// Indexes saved PropertyDNA reports into iOS Spotlight via Core Spotlight.
/// Users can find reports by address from the iOS home screen pull-down
/// search — no need to open the app first. Tapping a result opens the app
/// directly to that report's URL via NSUserActivity (handled in AppDelegate).
final class SpotlightIndexer: NSObject, WKScriptMessageHandler {

    static let shared = SpotlightIndexer()

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let id = body["id"] as? String else { return }

        if message.name == "pdnaDeindexReport" {
            CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: [id], completionHandler: nil)
            return
        }

        guard let address = body["address"] as? String else { return }
        let dnaScore = body["dnaScore"] as? Int
        let rating = body["rating"] as? String
        let reportUrl = body["reportUrl"] as? String

        let attr = CSSearchableItemAttributeSet(itemContentType: UTType.text.identifier)
        attr.title = address
        attr.contentDescription = "PropertyDNA report" +
            (rating != nil ? " · \(rating!) rated" : "") +
            (dnaScore != nil ? " · Score \(dnaScore!)/100" : "")
        attr.keywords = ["PropertyDNA", "real estate", "property report", address]
        if let urlString = reportUrl, let url = URL(string: urlString) {
            attr.contentURL = url
        }

        let item = CSSearchableItem(uniqueIdentifier: id,
                                    domainIdentifier: "com.thepropertydna.reports",
                                    attributeSet: attr)
        CSSearchableIndex.default().indexSearchableItems([item], completionHandler: nil)
    }
}
