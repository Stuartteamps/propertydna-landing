import UIKit
import Capacitor

/// The native root view controller. A real UITabBarController with four
/// children — Home (SwiftUI), Search (Capacitor bridge for /analyze and
/// report content), Map (native MKMapView), Account (SwiftUI).
///
/// This is the structural fix Apple's Guideline 4.2 requires: the *root*
/// of the application's view hierarchy is native iOS, not WebKit. The web
/// layer survives as one of four tabs, used for content (reports, blog,
/// dossiers) that genuinely is web-rendered, while the day-one user
/// experience is dominated by native UI.
final class NativeRootTabBarController: UITabBarController, UITabBarControllerDelegate {

    static weak var shared: NativeRootTabBarController?

    let homeVC = HomeViewController()
    let searchVC = PropertyDNABridgeViewController()
    let mapVC = MapTabViewController()
    let accountVC = AccountViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        Self.shared = self
        delegate = self

        // Capacitor's bridge view controller becomes the Search tab — this
        // is what hosts the WKWebView for the /analyze and /report content.
        // Wrapping in a passthrough container lets us give it a tab bar item.
        let searchContainer = SearchTabContainerViewController(bridge: searchVC)
        searchContainer.tabBarItem = UITabBarItem(
            title: "Search",
            image: UIImage(systemName: "magnifyingglass"),
            selectedImage: UIImage(systemName: "magnifyingglass.circle.fill")
        )

        viewControllers = [homeVC, searchContainer, mapVC, accountVC]
        selectedIndex = 0

        // Apply PropertyDNA brand tint to the tab bar.
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 10/255.0, green: 9/255.0, blue: 8/255.0, alpha: 1)
        let gold = UIColor(red: 201/255.0, green: 168/255.0, blue: 76/255.0, alpha: 1)
        let muted = UIColor(red: 107/255.0, green: 98/255.0, blue: 82/255.0, alpha: 1)
        appearance.stackedLayoutAppearance.selected.iconColor = gold
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: gold]
        appearance.stackedLayoutAppearance.normal.iconColor = muted
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: muted]
        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance
    }

    /// Public navigation entry point used by all SwiftUI buttons + native
    /// action handlers + Quick Actions + App Intents. Routes to the right
    /// tab, then drives the web layer to the path if needed.
    @objc func openWebPath(_ path: String) {
        // Heuristic: Map → Map tab, Account/Dashboard → Account, everything
        // else → Search tab (which loads the path inside the bridge webview).
        if path.hasPrefix("/market-heatmaps") {
            selectedIndex = 2
        } else if path.hasPrefix("/dashboard") || path == "/account" {
            // Open the deep link inside the Search tab's webview (Dashboard
            // content is React-rendered) but switch to it via Search tab to
            // keep the bridge alive.
            navigateBridge(to: path)
            selectedIndex = 1
        } else {
            navigateBridge(to: path)
            selectedIndex = 1
        }
    }

    private func navigateBridge(to path: String) {
        guard let webView = searchVC.webView else { return }
        let js = "if (window.location.pathname + window.location.hash !== \"\(path)\") { window.history.pushState({}, '', \"\(path)\"); window.dispatchEvent(new PopStateEvent('popstate')); }"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
}

/// Lightweight container that lets a CAPBridgeViewController live inside a
/// UITabBarController with a proper tabBarItem. Adds the bridge VC as a
/// child and pins its view edge-to-edge.
final class SearchTabContainerViewController: UIViewController {

    let bridge: PropertyDNABridgeViewController

    init(bridge: PropertyDNABridgeViewController) {
        self.bridge = bridge
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        addChild(bridge)
        view.addSubview(bridge.view)
        bridge.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            bridge.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridge.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridge.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridge.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        bridge.didMove(toParent: self)
    }
}
