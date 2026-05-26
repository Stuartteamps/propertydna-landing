import UIKit
import MapKit
import CoreLocation

/// Dedicated Map tab — a full-screen MKMapView with type selector and
/// "find me" button. Uses Apple's native map renderer (tile-based,
/// hardware-accelerated, with 3-D buildings and Look Around where
/// imagery is available). The Leaflet map inside the web bundle is the
/// fallback for the iOS app's web tab; this native map is the primary
/// map surface.
final class MapTabViewController: UIViewController, MKMapViewDelegate, CLLocationManagerDelegate {

    private let mapView = MKMapView()
    private let typeControl = UISegmentedControl(items: ["Standard", "Satellite", "Hybrid"])
    private let locationButton = UIButton(type: .system)
    private let titleBar = UIView()
    private let titleLabel = UILabel()
    private let locationManager = CLLocationManager()

    init() {
        super.init(nibName: nil, bundle: nil)
        title = "Map"
        tabBarItem = UITabBarItem(
            title: "Map",
            image: UIImage(systemName: "map"),
            selectedImage: UIImage(systemName: "map.fill")
        )
    }

    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 10/255.0, green: 9/255.0, blue: 8/255.0, alpha: 1)
        setupMap()
        setupTitleBar()
        setupControls()
        centerOnDefaultRegion()
    }

    private func setupMap() {
        mapView.frame = view.bounds
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.showsUserLocation = false
        mapView.showsBuildings = true
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.pointOfInterestFilter = .includingAll
        view.addSubview(mapView)
    }

    private func setupTitleBar() {
        titleBar.backgroundColor = UIColor(red: 10/255.0, green: 9/255.0, blue: 8/255.0, alpha: 0.92)
        titleBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleBar)

        let tag = UILabel()
        tag.text = "PROPERTYDNA"
        tag.textColor = UIColor(red: 201/255.0, green: 168/255.0, blue: 76/255.0, alpha: 1)
        tag.font = UIFont.systemFont(ofSize: 10, weight: .medium)
        tag.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(tag)

        titleLabel.text = "Map"
        titleLabel.textColor = UIColor(red: 240/255.0, green: 235/255.0, blue: 224/255.0, alpha: 1)
        titleLabel.font = UIFont.systemFont(ofSize: 28, weight: .light)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            titleBar.topAnchor.constraint(equalTo: view.topAnchor),
            titleBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            titleBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            titleBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 76),

            tag.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor, constant: 20),
            tag.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor, constant: 20),
            titleLabel.topAnchor.constraint(equalTo: tag.bottomAnchor, constant: 2),
        ])
    }

    private func setupControls() {
        typeControl.selectedSegmentIndex = 0
        typeControl.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        typeControl.addTarget(self, action: #selector(typeChanged(_:)), for: .valueChanged)
        typeControl.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(typeControl)

        locationButton.setImage(UIImage(systemName: "location"), for: .normal)
        locationButton.tintColor = UIColor(red: 201/255.0, green: 168/255.0, blue: 76/255.0, alpha: 1)
        locationButton.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        locationButton.layer.cornerRadius = 22
        locationButton.translatesAutoresizingMaskIntoConstraints = false
        locationButton.addTarget(self, action: #selector(locationTapped), for: .touchUpInside)
        view.addSubview(locationButton)

        NSLayoutConstraint.activate([
            typeControl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            typeControl.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            locationButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            locationButton.bottomAnchor.constraint(equalTo: typeControl.topAnchor, constant: -12),
            locationButton.widthAnchor.constraint(equalToConstant: 44),
            locationButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func centerOnDefaultRegion() {
        // Coachella Valley / Palm Springs region — PropertyDNA's anchor market.
        let center = CLLocationCoordinate2D(latitude: 33.8303, longitude: -116.5453)
        mapView.setRegion(MKCoordinateRegion(center: center,
                                             latitudinalMeters: 25000,
                                             longitudinalMeters: 25000), animated: false)
    }

    @objc private func typeChanged(_ sender: UISegmentedControl) {
        switch sender.selectedSegmentIndex {
        case 1: mapView.mapType = .satellite
        case 2: mapView.mapType = .hybrid
        default: mapView.mapType = .standard
        }
        UISelectionFeedbackGenerator().selectionChanged()
    }

    @objc private func locationTapped() {
        locationManager.delegate = self
        if locationManager.authorizationStatus == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        }
        locationManager.requestLocation()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.first else { return }
        mapView.setRegion(MKCoordinateRegion(center: loc.coordinate,
                                             latitudinalMeters: 1500,
                                             longitudinalMeters: 1500), animated: true)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Silent — keep showing the current region.
    }
}
