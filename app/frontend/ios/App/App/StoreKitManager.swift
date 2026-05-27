import Foundation
import StoreKit

/// In-App Purchase manager using StoreKit2 (iOS 16+).
///
/// NOT WIRED INTO BUILD 14 — this file is scaffolding for Build 15 when
/// IAP is the focused submission. To enable:
///   1. In App Store Connect, create the subscription group + products
///      under the IDs declared in `ProductIdentifier` below.
///   2. Add `StoreKitManager.swift` to the App target via tools/add-swift-files-to-pbxproj.rb.
///   3. Call `StoreKitManager.shared.startObserving()` from PropertyDNABridgeViewController.capacitorDidLoad
///      (so transactions arriving while the user has the app open are
///      received and acknowledged).
///   4. Add a Capacitor JS bridge for the web layer to invoke purchases
///      (a `pdnaPurchase` WKScriptMessageHandler that calls `purchase()`).
///   5. Surface a SwiftUI paywall sheet from PaywallView.swift.

enum ProductIdentifier: String, CaseIterable {
    case proMonthly = "com.thepropertydna.app.pro.monthly"
    case proYearly  = "com.thepropertydna.app.pro.yearly"

    var displayName: String {
        switch self {
        case .proMonthly: return "PropertyDNA Pro · Monthly"
        case .proYearly:  return "PropertyDNA Pro · Annual"
        }
    }
}

enum StoreKitError: Error {
    case productNotFound
    case purchaseCancelled
    case purchasePending
    case verificationFailed
    case unknown
}

@MainActor
final class StoreKitManager: ObservableObject {

    static let shared = StoreKitManager()

    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasedIdentifiers: Set<String> = []
    @Published private(set) var hasActiveSubscription: Bool = false

    private var updateListener: Task<Void, Never>?

    /// Call once at app launch to start receiving StoreKit transaction
    /// updates and to populate the product list.
    func startObserving() {
        updateListener?.cancel()
        updateListener = Task(priority: .background) { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(transactionResult: result)
            }
        }
        Task { await refresh() }
    }

    /// Load product metadata from the App Store and reconcile current
    /// subscription state against verified transactions.
    func refresh() async {
        do {
            let ids = ProductIdentifier.allCases.map(\.rawValue)
            let fetched = try await Product.products(for: ids)
            products = fetched.sorted { $0.price < $1.price }
        } catch {
            products = []
        }
        await refreshEntitlements()
    }

    /// Walk current entitlements and update `purchasedIdentifiers` + the
    /// boolean `hasActiveSubscription` flag.
    func refreshEntitlements() async {
        var ids: Set<String> = []
        for await result in Transaction.currentEntitlements {
            switch result {
            case .verified(let transaction):
                if transaction.revocationDate == nil &&
                   (transaction.expirationDate == nil || transaction.expirationDate! > Date()) {
                    ids.insert(transaction.productID)
                }
            case .unverified:
                continue
            }
        }
        purchasedIdentifiers = ids
        hasActiveSubscription = !ids.isEmpty
        if hasActiveSubscription {
            // Sync the latest entitlement to the backend so check-usage
            // returns isSubscribed=true cross-device for this user.
            await syncEntitlementToBackend()
        }
    }

    /// Initiate a purchase. Returns true if completed and verified.
    func purchase(_ product: Product) async throws -> Bool {
        let result = try await product.purchase()
        switch result {
        case .success(let verificationResult):
            switch verificationResult {
            case .verified(let transaction):
                await transaction.finish()
                await refreshEntitlements()
                return true
            case .unverified:
                throw StoreKitError.verificationFailed
            }
        case .userCancelled:
            throw StoreKitError.purchaseCancelled
        case .pending:
            throw StoreKitError.purchasePending
        @unknown default:
            throw StoreKitError.unknown
        }
    }

    /// Apple Guideline 3.1.1 requires a "Restore Purchases" affordance —
    /// invoke this when the user taps that button.
    func restorePurchases() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    // MARK: — Backend sync

    private func handle(transactionResult: VerificationResult<Transaction>) async {
        switch transactionResult {
        case .verified(let transaction):
            await transaction.finish()
            await refreshEntitlements()
        case .unverified:
            return
        }
    }

    /// Posts the current set of active product IDs + latest JWS receipt to
    /// our Netlify verify-apple-receipt function. The backend records the
    /// entitlement in Supabase so subsequent /check-usage calls (on any
    /// device, including web) reflect Pro status.
    private func syncEntitlementToBackend() async {
        guard let url = URL(string: "https://thepropertydna.com/.netlify/functions/verify-apple-receipt") else { return }
        guard let userEmail = UserDefaults.standard.string(forKey: "CapacitorStorage.pdna_email") else { return }

        // Walk current entitlements to gather verified JWS receipts
        var receipts: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let txn) = result {
                receipts.append(txn.jsonRepresentation.base64EncodedString())
            }
        }
        if receipts.isEmpty { return }

        let body: [String: Any] = [
            "email": userEmail,
            "receipts": receipts,
            "platform": "ios",
        ]
        guard let payload = try? JSONSerialization.data(withJSONObject: body) else { return }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = payload
        _ = try? await URLSession.shared.data(for: req)
    }
}
