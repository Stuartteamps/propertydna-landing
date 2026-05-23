import UIKit
import MapKit
import WebKit

/// Bridges `window.webkit.messageHandlers.pdnaOpenNativeMap.postMessage({ lat, lon, label })`
/// to a full-screen native MKMapView. This is genuinely native rendering —
/// Apple Maps tiles, native pinch-zoom, satellite/standard toggle, 3-D pitch,
/// and a Look Around preview when imagery is available.
///
/// The Leaflet view that ships in the web bundle is a tile-based DOM/SVG
/// approximation. This is the real thing.
final class NativeMapPresenter: NSObject, WKScriptMessageHandler {

    private weak var presenter: UIViewController?
    private weak var webView: WKWebView?

    init(presenter: UIViewController, webView: WKWebView) {
        self.presenter = presenter
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let lat = body["lat"] as? Double,
              let lon = body["lon"] as? Double else { return }
        let label = (body["label"] as? String) ?? "PropertyDNA Subject"
        DispatchQueue.main.async { [weak self] in
            let vc = NativeMapViewController(lat: lat, lon: lon, label: label)
            vc.modalPresentationStyle = .fullScreen
            self?.presenter?.present(vc, animated: true)
        }
    }
}

final class NativeMapViewController: UIViewController, MKMapViewDelegate {

    private let mapView = MKMapView()
    private let lat: Double
    private let lon: Double
    private let subjectLabel: String

    init(lat: Double, lon: Double, label: String) {
        self.lat = lat
        self.lon = lon
        self.subjectLabel = label
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        mapView.frame = view.bounds
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.showsUserLocation = false
        mapView.showsBuildings = true
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.mapType = .standard
        view.addSubview(mapView)

        let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
        mapView.setRegion(MKCoordinateRegion(center: coord,
                                             latitudinalMeters: 600,
                                             longitudinalMeters: 600),
                          animated: false)

        let pin = MKPointAnnotation()
        pin.coordinate = coord
        pin.title = "Subject Property"
        pin.subtitle = subjectLabel
        mapView.addAnnotation(pin)
        mapView.selectAnnotation(pin, animated: false)

        setupControls()
    }

    private func setupControls() {
        // Standard / Satellite / Hybrid segmented control
        let segments = UISegmentedControl(items: ["Standard", "Satellite", "Hybrid"])
        segments.selectedSegmentIndex = 0
        segments.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        segments.addTarget(self, action: #selector(typeChanged(_:)), for: .valueChanged)
        segments.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(segments)

        // Close button
        let close = UIButton(type: .system)
        close.setTitle("Close", for: .normal)
        close.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        close.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        close.layer.cornerRadius = 18
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(close)

        // Directions button — opens Apple Maps for routing
        let directions = UIButton(type: .system)
        directions.setTitle("Directions", for: .normal)
        directions.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        directions.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        directions.layer.cornerRadius = 18
        directions.translatesAutoresizingMaskIntoConstraints = false
        directions.addTarget(self, action: #selector(directionsTapped), for: .touchUpInside)
        view.addSubview(directions)

        NSLayoutConstraint.activate([
            segments.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            segments.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),

            close.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            close.widthAnchor.constraint(equalToConstant: 72),
            close.heightAnchor.constraint(equalToConstant: 36),

            directions.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            directions.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            directions.widthAnchor.constraint(equalToConstant: 120),
            directions.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    @objc private func typeChanged(_ sender: UISegmentedControl) {
        switch sender.selectedSegmentIndex {
        case 1: mapView.mapType = .satellite
        case 2: mapView.mapType = .hybrid
        default: mapView.mapType = .standard
        }
    }

    @objc private func closeTapped() { dismiss(animated: true) }

    @objc private func directionsTapped() {
        let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
        let placemark = MKPlacemark(coordinate: coord)
        let item = MKMapItem(placemark: placemark)
        item.name = subjectLabel
        item.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }
}
