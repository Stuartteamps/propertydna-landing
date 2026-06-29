import UIKit
import MapKit
import CoreLocation
import SwiftUI

// MARK: - Brand palette

private enum PDNA {
    static let gold = UIColor(red: 201/255.0, green: 168/255.0, blue: 76/255.0, alpha: 1)
    static let goldDim = UIColor(red: 110/255.0, green: 90/255.0, blue: 40/255.0, alpha: 1)
    static let dark = UIColor(red: 10/255.0, green: 9/255.0, blue: 8/255.0, alpha: 1)
    static let cream = UIColor(red: 240/255.0, green: 235/255.0, blue: 224/255.0, alpha: 1)

    static var goldSUI: Color { Color(red: 201/255.0, green: 168/255.0, blue: 76/255.0) }
    static var darkSUI: Color { Color(red: 10/255.0, green: 9/255.0, blue: 8/255.0) }
    static var creamSUI: Color { Color(red: 240/255.0, green: 235/255.0, blue: 224/255.0) }

    /// Interpolated chip fill: deep bronze for low score → bright gold for high score.
    static func chipColor(score: Int) -> UIColor {
        let t = max(0, min(1, CGFloat(score) / 100))
        let lr: CGFloat = 70/255,  lg: CGFloat = 56/255,  lb: CGFloat = 24/255   // bronze
        let hr: CGFloat = 201/255, hg: CGFloat = 168/255, hb: CGFloat = 76/255   // gold
        return UIColor(red: lr + (hr - lr) * t,
                       green: lg + (hg - lg) * t,
                       blue: lb + (hb - lb) * t,
                       alpha: 1)
    }

    static func textColor(on fill: UIColor) -> UIColor {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        fill.getRed(&r, green: &g, blue: &b, alpha: &a)
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b
        return luminance > 0.55 ? dark : cream
    }
}

// MARK: - Data model

/// One PropertyDNA parcel as returned by `get-heatmap-parcels`.
struct PDNAParcel: Decodable {
    let id: String
    let address: String
    let city: String
    let state: String
    let zip: String
    let lat: Double
    let lon: Double
    let score: Int
    let confidence: Double
    let price: Double
    let pricePerSqft: Double
    let sqft: Double
    let bedrooms: Double
    let bathrooms: Double
    let yearBuilt: Int
    let dom: Int
    let neighborhood: String?
    let sparkline: [Double]?

    enum CodingKeys: String, CodingKey {
        case id, address, city, state, zip, lat, lon, score, confidence
        case price, pricePerSqft, sqft, bedrooms, bathrooms, yearBuilt, dom
        case neighborhood, sparkline
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Tolerant decoding — the API may omit or vary types on some fields.
        id           = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        address      = (try? c.decode(String.self, forKey: .address)) ?? "Property"
        city         = (try? c.decode(String.self, forKey: .city)) ?? ""
        state        = (try? c.decode(String.self, forKey: .state)) ?? ""
        zip          = (try? c.decode(String.self, forKey: .zip)) ?? ""
        lat          = (try? c.decode(Double.self, forKey: .lat)) ?? 0
        lon          = (try? c.decode(Double.self, forKey: .lon)) ?? 0
        score        = (try? c.decode(Int.self, forKey: .score)) ?? 0
        confidence   = (try? c.decode(Double.self, forKey: .confidence)) ?? 0
        price        = (try? c.decode(Double.self, forKey: .price)) ?? 0
        pricePerSqft = (try? c.decode(Double.self, forKey: .pricePerSqft)) ?? 0
        sqft         = (try? c.decode(Double.self, forKey: .sqft)) ?? 0
        bedrooms     = (try? c.decode(Double.self, forKey: .bedrooms)) ?? 0
        bathrooms    = (try? c.decode(Double.self, forKey: .bathrooms)) ?? 0
        yearBuilt    = (try? c.decode(Int.self, forKey: .yearBuilt)) ?? 0
        dom          = (try? c.decode(Int.self, forKey: .dom)) ?? 0
        neighborhood = try? c.decode(String.self, forKey: .neighborhood)
        sparkline    = try? c.decode([Double].self, forKey: .sparkline)
    }

    /// Risk-adjusted value. ASSUMPTION: the API returns a headline `price` and a
    /// 0–100 `score` + 0–1 `confidence` but no explicit risk-adjusted figure, so we
    /// derive one client-side: a score above the neutral 50 lifts value, below it
    /// discounts, scaled by how confident the model is (low confidence → stays near price).
    var riskAdjustedValue: Double {
        let scoreDelta = (Double(score) - 50.0) / 50.0          // -1 … +1
        return price * (1.0 + 0.12 * scoreDelta * confidence)
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

private struct HeatmapResponse: Decodable {
    let parcels: [PDNAParcel]
    let count: Int?
    let city: String?
}

// MARK: - Currency formatting

enum PDNAFormat {
    static func compactUSD(_ value: Double) -> String {
        guard value > 0 else { return "—" }
        if value >= 1_000_000 {
            return String(format: "$%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "$%.0fK", value / 1_000)
        }
        return String(format: "$%.0f", value)
    }

    static func fullUSD(_ value: Double) -> String {
        guard value > 0 else { return "—" }
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: value)) ?? compactUSD(value)
    }
}

// MARK: - Annotation

final class ParcelAnnotation: NSObject, MKAnnotation {
    let parcel: PDNAParcel
    var coordinate: CLLocationCoordinate2D { parcel.coordinate }
    var title: String? { parcel.address }
    var subtitle: String? { PDNAFormat.compactUSD(parcel.price) }

    init(parcel: PDNAParcel) { self.parcel = parcel }
}

// MARK: - Value-chip annotation view

final class ValueChipAnnotationView: MKAnnotationView {
    static let reuseID = "PDNAValueChip"

    private let chip = UIView()
    private let label = UILabel()

    override var annotation: MKAnnotation? {
        didSet { configure() }
    }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        clusteringIdentifier = "pdnaParcel"
        canShowCallout = false
        collisionMode = .circle
        centerOffset = CGPoint(x: 0, y: -12)

        chip.layer.cornerRadius = 11
        chip.layer.borderWidth = 1
        chip.layer.borderColor = PDNA.dark.withAlphaComponent(0.35).cgColor
        chip.layer.shadowColor = UIColor.black.cgColor
        chip.layer.shadowOpacity = 0.35
        chip.layer.shadowRadius = 3
        chip.layer.shadowOffset = CGSize(width: 0, height: 1)
        chip.isUserInteractionEnabled = false
        chip.translatesAutoresizingMaskIntoConstraints = false
        addSubview(chip)

        label.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        chip.addSubview(label)

        NSLayoutConstraint.activate([
            chip.centerXAnchor.constraint(equalTo: centerXAnchor),
            chip.centerYAnchor.constraint(equalTo: centerYAnchor),
            label.leadingAnchor.constraint(equalTo: chip.leadingAnchor, constant: 9),
            label.trailingAnchor.constraint(equalTo: chip.trailingAnchor, constant: -9),
            label.topAnchor.constraint(equalTo: chip.topAnchor, constant: 4),
            label.bottomAnchor.constraint(equalTo: chip.bottomAnchor, constant: -4),
        ])
        configure()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func configure() {
        guard let parcel = (annotation as? ParcelAnnotation)?.parcel else { return }
        let fill = PDNA.chipColor(score: parcel.score)
        chip.backgroundColor = fill
        label.textColor = PDNA.textColor(on: fill)
        label.text = PDNAFormat.compactUSD(parcel.price)
        // Size to fit
        setNeedsLayout()
        layoutIfNeeded()
        let size = systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
        frame = CGRect(x: 0, y: 0, width: max(size.width, 52), height: max(size.height, 24))
    }
}

// MARK: - Cluster annotation view

final class ParcelClusterView: MKAnnotationView {
    static let reuseID = "PDNAParcelCluster"

    private let bubble = UIView()
    private let label = UILabel()

    override var annotation: MKAnnotation? { didSet { configure() } }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        canShowCallout = false
        collisionMode = .circle
        frame = CGRect(x: 0, y: 0, width: 40, height: 40)

        bubble.frame = bounds
        bubble.backgroundColor = PDNA.dark.withAlphaComponent(0.92)
        bubble.layer.cornerRadius = 20
        bubble.layer.borderWidth = 1.5
        bubble.layer.borderColor = PDNA.gold.cgColor
        bubble.isUserInteractionEnabled = false
        addSubview(bubble)

        label.frame = bounds
        label.textAlignment = .center
        label.textColor = PDNA.gold
        label.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        addSubview(label)
        configure()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func configure() {
        guard let cluster = annotation as? MKClusterAnnotation else { return }
        label.text = "\(cluster.memberAnnotations.count)"
    }
}

// MARK: - Map tab

final class MapTabViewController: UIViewController, MKMapViewDelegate, CLLocationManagerDelegate {

    private let mapView = MKMapView()
    private let typeControl = UISegmentedControl(items: ["Standard", "Satellite", "Hybrid"])
    private let locationButton = UIButton(type: .system)
    private let titleBar = UIView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let loadingIndicator = UIActivityIndicatorView(style: .medium)
    private let locationManager = CLLocationManager()

    // Data + fetch state
    private let geocoder = CLGeocoder()
    private var loadedParcels: [PDNAParcel] = []
    private var loadedCityKey: String?          // "city|state" of the cached parcels
    private var inFlightCityKey: String?
    private var regionDebounce: DispatchWorkItem?
    private let maxPins = 220

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
        view.backgroundColor = PDNA.dark
        setupMap()
        setupTitleBar()
        setupControls()
        centerOnDefaultRegion()
        // Initial load for the default (Palm Springs) region.
        scheduleRegionRefresh(delay: 0.2)
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
        mapView.register(ValueChipAnnotationView.self,
                         forAnnotationViewWithReuseIdentifier: ValueChipAnnotationView.reuseID)
        mapView.register(ParcelClusterView.self,
                         forAnnotationViewWithReuseIdentifier: ParcelClusterView.reuseID)
        view.addSubview(mapView)
    }

    private func setupTitleBar() {
        titleBar.backgroundColor = PDNA.dark.withAlphaComponent(0.92)
        titleBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleBar)

        let tag = UILabel()
        tag.text = "PROPERTYDNA"
        tag.textColor = PDNA.gold
        tag.font = UIFont.systemFont(ofSize: 10, weight: .medium)
        tag.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(tag)

        titleLabel.text = "Map"
        titleLabel.textColor = PDNA.cream
        titleLabel.font = UIFont.systemFont(ofSize: 28, weight: .light)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(titleLabel)

        subtitleLabel.text = "Intelligence layer"
        subtitleLabel.textColor = PDNA.cream.withAlphaComponent(0.6)
        subtitleLabel.font = UIFont.systemFont(ofSize: 11, weight: .regular)
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(subtitleLabel)

        loadingIndicator.color = PDNA.gold
        loadingIndicator.hidesWhenStopped = true
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        titleBar.addSubview(loadingIndicator)

        NSLayoutConstraint.activate([
            titleBar.topAnchor.constraint(equalTo: view.topAnchor),
            titleBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            titleBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            titleBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 76),

            tag.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor, constant: 20),
            tag.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: titleBar.leadingAnchor, constant: 20),
            titleLabel.topAnchor.constraint(equalTo: tag.bottomAnchor, constant: 2),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 10),
            subtitleLabel.firstBaselineAnchor.constraint(equalTo: titleLabel.firstBaselineAnchor),

            loadingIndicator.trailingAnchor.constraint(equalTo: titleBar.trailingAnchor, constant: -20),
            loadingIndicator.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
        ])
    }

    private func setupControls() {
        typeControl.selectedSegmentIndex = 0
        typeControl.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        typeControl.addTarget(self, action: #selector(typeChanged(_:)), for: .valueChanged)
        typeControl.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(typeControl)

        locationButton.setImage(UIImage(systemName: "location"), for: .normal)
        locationButton.tintColor = PDNA.gold
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

    // MARK: CLLocationManager

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.first else { return }
        mapView.setRegion(MKCoordinateRegion(center: loc.coordinate,
                                             latitudinalMeters: 4000,
                                             longitudinalMeters: 4000), animated: true)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Silent — keep showing the current region.
    }

    // MARK: Region change → debounced fetch

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        scheduleRegionRefresh(delay: 0.6)
    }

    private func scheduleRegionRefresh(delay: TimeInterval) {
        regionDebounce?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.refreshForCurrentRegion() }
        regionDebounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    /// Reverse-geocode the map center → city/state, then fetch (or re-cull cached) parcels.
    private func refreshForCurrentRegion() {
        let center = mapView.centerCoordinate
        let loc = CLLocation(latitude: center.latitude, longitude: center.longitude)
        geocoder.cancelGeocode()
        geocoder.reverseGeocodeLocation(loc) { [weak self] placemarks, _ in
            guard let self = self else { return }
            guard let pm = placemarks?.first,
                  let city = pm.locality,
                  let state = pm.administrativeArea else { return }
            let key = "\(city.lowercased())|\(state.lowercased())"

            if key == self.loadedCityKey {
                // Same city already cached — just re-cull to the new viewport.
                self.renderVisibleParcels()
                return
            }
            self.fetchParcels(city: city, state: state, key: key)
        }
    }

    private func fetchParcels(city: String, state: String, key: String) {
        guard key != inFlightCityKey else { return }
        inFlightCityKey = key

        var comps = URLComponents(string: "https://thepropertydna.com/.netlify/functions/get-heatmap-parcels")!
        comps.queryItems = [
            URLQueryItem(name: "city", value: city),
            URLQueryItem(name: "state", value: state),
        ]
        guard let url = comps.url else { inFlightCityKey = nil; return }

        DispatchQueue.main.async { self.loadingIndicator.startAnimating() }

        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            guard let self = self else { return }
            var parcels: [PDNAParcel] = []
            if let data = data,
               let decoded = try? JSONDecoder().decode(HeatmapResponse.self, from: data) {
                parcels = decoded.parcels.filter { $0.lat != 0 && $0.lon != 0 && $0.price > 0 }
            }
            DispatchQueue.main.async {
                self.loadingIndicator.stopAnimating()
                self.inFlightCityKey = nil
                self.loadedParcels = parcels
                self.loadedCityKey = key
                self.subtitleLabel.text = parcels.isEmpty
                    ? "No live data here"
                    : "\(parcels.count) tracked"
                self.renderVisibleParcels()
            }
        }.resume()
    }

    /// Cull cached parcels to the visible map rect, cap to `maxPins` (highest score first),
    /// and diff them against the map's current parcel annotations.
    private func renderVisibleParcels() {
        let visibleRect = mapView.visibleMapRect
        let visible = loadedParcels.filter { p in
            let point = MKMapPoint(p.coordinate)
            return visibleRect.contains(point)
        }
        let capped = Array(visible.sorted { $0.score > $1.score }.prefix(maxPins))

        let existing = mapView.annotations.compactMap { $0 as? ParcelAnnotation }
        let existingIDs = Set(existing.map { $0.parcel.id })
        let keepIDs = Set(capped.map { $0.id })

        let toRemove = existing.filter { !keepIDs.contains($0.parcel.id) }
        let toAdd = capped.filter { !existingIDs.contains($0.id) }.map { ParcelAnnotation(parcel: $0) }

        mapView.removeAnnotations(toRemove)
        mapView.addAnnotations(toAdd)
    }

    // MARK: Annotation views

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        if annotation is MKUserLocation { return nil }

        if annotation is MKClusterAnnotation {
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: ParcelClusterView.reuseID, for: annotation)
            view.annotation = annotation
            return view
        }

        if annotation is ParcelAnnotation {
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: ValueChipAnnotationView.reuseID, for: annotation)
            view.annotation = annotation
            return view
        }
        return nil
    }

    func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
        UISelectionFeedbackGenerator().selectionChanged()

        if let cluster = view.annotation as? MKClusterAnnotation {
            // Zoom into a cluster on tap.
            mapView.deselectAnnotation(cluster, animated: false)
            let region = MKCoordinateRegion(
                center: cluster.coordinate,
                latitudinalMeters: max(mapView.region.span.latitudeDelta * 111_000 / 2.4, 1200),
                longitudinalMeters: max(mapView.region.span.longitudeDelta * 111_000 / 2.4, 1200))
            mapView.setRegion(region, animated: true)
            return
        }

        guard let parcel = (view.annotation as? ParcelAnnotation)?.parcel else { return }
        mapView.deselectAnnotation(view.annotation, animated: false)
        presentDetailSheet(for: parcel)
    }

    // MARK: Detail sheet

    private func presentDetailSheet(for parcel: PDNAParcel) {
        let host = UIHostingController(rootView: ParcelDetailView(parcel: parcel))
        host.view.backgroundColor = PDNA.dark
        host.overrideUserInterfaceStyle = .dark

        if let sheet = host.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 22
            sheet.largestUndimmedDetentIdentifier = .medium
        }
        present(host, animated: true)
    }
}

// MARK: - SwiftUI detail sheet (Fidelity-style, client-empowerment)

struct ParcelDetailView: View {
    let parcel: PDNAParcel

    private var scoreColor: Color {
        let t = max(0, min(1, Double(parcel.score) / 100))
        return Color(red: 70/255 + (201/255 - 70/255) * t,
                     green: 56/255 + (168/255 - 56/255) * t,
                     blue: 24/255 + (76/255 - 24/255) * t)
    }

    private var confidencePct: Int { Int((parcel.confidence * 100).rounded()) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {

                // Header — address + neighborhood
                VStack(alignment: .leading, spacing: 4) {
                    Text("PROPERTYDNA")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(2)
                        .foregroundColor(PDNA.goldSUI)
                    Text(parcel.address)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(PDNA.creamSUI)
                        .fixedSize(horizontal: false, vertical: true)
                    if let hood = parcel.neighborhood, !hood.isEmpty {
                        Text(hood)
                            .font(.system(size: 13))
                            .foregroundColor(PDNA.creamSUI.opacity(0.6))
                    }
                }

                // Headline value
                VStack(alignment: .leading, spacing: 2) {
                    Text("PROPERTYDNA VALUE")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.5)
                        .foregroundColor(PDNA.creamSUI.opacity(0.5))
                    Text(PDNAFormat.fullUSD(parcel.price))
                        .font(.system(size: 38, weight: .light))
                        .foregroundColor(PDNA.goldSUI)
                }

                // Risk-adjusted value + confidence chip
                HStack(spacing: 12) {
                    valueTile(title: "RISK-ADJUSTED VALUE",
                              value: PDNAFormat.fullUSD(parcel.riskAdjustedValue))
                    confidenceChip
                }

                // Value bar — score as a portfolio-style strength bar
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("PROPERTYDNA SCORE")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.5)
                            .foregroundColor(PDNA.creamSUI.opacity(0.5))
                        Spacer()
                        Text("\(parcel.score)/100")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(scoreColor)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(PDNA.creamSUI.opacity(0.12))
                            Capsule()
                                .fill(scoreColor)
                                .frame(width: geo.size.width * CGFloat(max(0, min(100, parcel.score))) / 100)
                        }
                    }
                    .frame(height: 8)
                }

                // Spark line (recent trend) if available
                if let spark = parcel.sparkline, spark.count > 2 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("30-DAY TREND")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.5)
                            .foregroundColor(PDNA.creamSUI.opacity(0.5))
                        Sparkline(values: spark)
                            .stroke(PDNA.goldSUI, lineWidth: 1.8)
                            .frame(height: 44)
                    }
                }

                // Key stats grid
                VStack(spacing: 10) {
                    statRow("Price / sq ft", parcel.pricePerSqft > 0 ? PDNAFormat.fullUSD(parcel.pricePerSqft) : "—")
                    statRow("Days on market", parcel.dom > 0 ? "\(parcel.dom)" : "—")
                    if parcel.sqft > 0 { statRow("Living area", "\(Int(parcel.sqft)) sq ft") }
                    if parcel.bedrooms > 0 || parcel.bathrooms > 0 {
                        statRow("Beds / baths", "\(trimmed(parcel.bedrooms)) bd / \(trimmed(parcel.bathrooms)) ba")
                    }
                    if parcel.yearBuilt > 0 { statRow("Year built", "\(parcel.yearBuilt)") }
                }

                // Client-empowerment copy
                VStack(alignment: .leading, spacing: 8) {
                    Text("Track your home like a portfolio.")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(PDNA.creamSUI)
                    Text("PropertyDNA values every home with the same risk lens an analyst uses for a stock — so you can understand your risk, not just a number an agent hands you.")
                        .font(.system(size: 13))
                        .foregroundColor(PDNA.creamSUI.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(PDNA.goldSUI.opacity(0.08))
                        .overlay(RoundedRectangle(cornerRadius: 14)
                            .stroke(PDNA.goldSUI.opacity(0.25), lineWidth: 1))
                )

                Spacer(minLength: 8)
            }
            .padding(20)
        }
        .background(PDNA.darkSUI.ignoresSafeArea())
    }

    private var confidenceChip: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("CONFIDENCE")
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.2)
                .foregroundColor(PDNA.darkSUI.opacity(0.65))
            Text("\(confidencePct)%")
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(PDNA.darkSUI)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(PDNA.goldSUI))
    }

    private func valueTile(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.2)
                .foregroundColor(PDNA.creamSUI.opacity(0.5))
            Text(value)
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(PDNA.creamSUI)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(PDNA.creamSUI.opacity(0.06))
                .overlay(RoundedRectangle(cornerRadius: 12)
                    .stroke(PDNA.creamSUI.opacity(0.12), lineWidth: 1))
        )
    }

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundColor(PDNA.creamSUI.opacity(0.65))
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(PDNA.creamSUI)
        }
        .overlay(Rectangle()
            .fill(PDNA.creamSUI.opacity(0.08))
            .frame(height: 1), alignment: .bottom)
        .padding(.bottom, 6)
    }

    private func trimmed(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}

// MARK: - Sparkline shape

struct Sparkline: Shape {
    let values: [Double]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard values.count > 1 else { return path }
        let minV = values.min() ?? 0
        let maxV = values.max() ?? 1
        let range = max(maxV - minV, 0.0001)
        let stepX = rect.width / CGFloat(values.count - 1)

        for (i, v) in values.enumerated() {
            let x = CGFloat(i) * stepX
            let y = rect.height - CGFloat((v - minV) / range) * rect.height
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
            else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        return path
    }
}
