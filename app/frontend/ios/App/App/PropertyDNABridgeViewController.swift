import UIKit
import Capacitor
import WebKit
import CoreSpotlight
import MobileCoreServices
import UniformTypeIdentifiers

/// Subclass of CAPBridgeViewController that wires the embedded web layer to
/// native iOS frameworks (AVFoundation/Vision, MapKit, Core Spotlight,
/// App Intents). Each capability is implemented in native Swift — the JS
/// layer simply *invokes* it via `window.webkit.messageHandlers.<name>` and
/// receives the result via `evaluateJavaScript`.
///
/// This is the integration point Apple requires under Guideline 4.2:
/// substantial native code beyond a wrapped web view.
final class PropertyDNABridgeViewController: CAPBridgeViewController {

    private var visionScanner: VisionScannerCoordinator?
    private var mapPresenter: NativeMapPresenter?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = self.webView else { return }
        let controller = webView.configuration.userContentController

        // 1. Vision OCR scanner — native camera + on-device text recognition
        let scanner = VisionScannerCoordinator(presenter: self, webView: webView)
        controller.add(scanner, name: "pdnaScanAddress")
        self.visionScanner = scanner

        // 2. Native MapKit modal — replaces Leaflet for "show location"
        let map = NativeMapPresenter(presenter: self, webView: webView)
        controller.add(map, name: "pdnaOpenNativeMap")
        self.mapPresenter = map

        // 3. Core Spotlight indexing — saved reports appear in iOS Spotlight
        controller.add(SpotlightIndexer.shared, name: "pdnaIndexReport")
        controller.add(SpotlightIndexer.shared, name: "pdnaDeindexReport")

        // 4. Donate App Intent shortcuts so Siri learns the user's flow
        AppShortcutManager.donateOnLaunch()
    }
}
