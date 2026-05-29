import Foundation
import WebKit
import StoreKit

/// Bridges the web layer to native StoreKit2 purchases.
///
/// JS calls (registered as WKScriptMessageHandlers in PropertyDNABridgeViewController):
///   window.webkit.messageHandlers.pdnaPurchase.postMessage({productId: "com.thepropertydna.app.pro.monthly"})
///   window.webkit.messageHandlers.pdnaRestorePurchases.postMessage({})
///
/// The bridge dispatches CustomEvents on `window` so the web layer can react:
///   pdna:purchase-success    { productId }
///   pdna:purchase-cancelled  { productId }
///   pdna:purchase-error      { error, productId? }
///   pdna:purchase-restored   { active }
@available(iOS 16.0, *)
final class PurchaseBridge: NSObject, WKScriptMessageHandler {
    static let shared = PurchaseBridge()
    weak var webView: WKWebView?

    private override init() { super.init() }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        webView = message.webView
        switch message.name {
        case "pdnaPurchase":
            guard let body = message.body as? [String: Any],
                  let productId = body["productId"] as? String else {
                dispatch(event: "pdna:purchase-error", detail: ["error": "missing productId"])
                return
            }
            Task { await handlePurchase(productId: productId) }
        case "pdnaRestorePurchases":
            Task {
                await StoreKitManager.shared.restorePurchases()
                let active = await MainActor.run { StoreKitManager.shared.hasActiveSubscription }
                dispatch(event: "pdna:purchase-restored", detail: ["active": active])
            }
        default:
            break
        }
    }

    private func handlePurchase(productId: String) async {
        do {
            let products = try await Product.products(for: [productId])
            guard let product = products.first else {
                dispatch(event: "pdna:purchase-error", detail: ["error": "product not found", "productId": productId])
                return
            }
            let ok = try await StoreKitManager.shared.purchase(product)
            if ok {
                dispatch(event: "pdna:purchase-success", detail: ["productId": productId])
            } else {
                dispatch(event: "pdna:purchase-cancelled", detail: ["productId": productId])
            }
        } catch {
            // StoreKitManager throws purchaseCancelled for user cancels — surface as cancelled, not error.
            let msg = String(describing: error).lowercased()
            if msg.contains("cancel") {
                dispatch(event: "pdna:purchase-cancelled", detail: ["productId": productId])
            } else {
                dispatch(event: "pdna:purchase-error",
                         detail: ["error": String(describing: error), "productId": productId])
            }
        }
    }

    private func dispatch(event: String, detail: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: detail)) ?? Data("{}".utf8)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        let js = "window.dispatchEvent(new CustomEvent('\(event)', { detail: \(json) }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js)
        }
    }
}
