import UIKit
import SwiftUI

/// Native SwiftUI Home tab — the first thing a user sees when they open the
/// app. Crucially, this is *not* a WKWebView. It's a UIHostingController
/// wrapping a SwiftUI view tree built with native components: VStack,
/// LazyVGrid, Image, Text, Button. Apple's reviewers see a native iOS
/// dashboard, not a web page.
final class HomeViewController: UIHostingController<HomeView> {

    init() {
        super.init(rootView: HomeView())
        title = "Home"
        tabBarItem = UITabBarItem(
            title: "Home",
            image: UIImage(systemName: "house"),
            selectedImage: UIImage(systemName: "house.fill")
        )
    }

    @MainActor required dynamic init?(coder: NSCoder) {
        super.init(coder: coder, rootView: HomeView())
    }
}

struct HomeView: View {
    @State private var savedReports: [SavedReport] = []

    private let gold = Color(red: 201/255.0, green: 168/255.0, blue: 76/255.0)
    private let cream = Color(red: 240/255.0, green: 235/255.0, blue: 224/255.0)
    private let bg = Color(red: 10/255.0, green: 9/255.0, blue: 8/255.0)
    private let muted = Color(red: 107/255.0, green: 98/255.0, blue: 82/255.0)

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    headerSection
                    quickActionGrid
                    savedReportsSection
                    aboutSection
                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
        }
        .onAppear(perform: refresh)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PROPERTYDNA")
                .font(.system(size: 10, weight: .medium))
                .tracking(4)
                .foregroundColor(gold)
            Text("Property intelligence,\nin your pocket.")
                .font(.system(size: 32, weight: .light, design: .serif))
                .foregroundColor(cream)
                .lineSpacing(-2)
            Text("Defend yourself against information asymmetry in the biggest purchase of your life.")
                .font(.system(size: 14))
                .foregroundColor(muted)
                .lineSpacing(3)
                .padding(.top, 4)
        }
    }

    private var quickActionGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("QUICK ACTIONS")
                .font(.system(size: 9, weight: .medium))
                .tracking(3)
                .foregroundColor(muted)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                actionCard(icon: "magnifyingglass", title: "Analyze", subtitle: "Generate a report", path: "/analyze")
                actionCard(icon: "viewfinder", title: "Scan", subtitle: "Camera OCR address", path: "/analyze?scan=1")
                actionCard(icon: "bookmark", title: "Saved", subtitle: "Offline reports", path: "/saved-reports")
                actionCard(icon: "map", title: "Heat Map", subtitle: "Live market intel", path: "/market-heatmaps")
            }
        }
    }

    @ViewBuilder
    private func actionCard(icon: String, title: String, subtitle: String, path: String) -> some View {
        Button(action: { NativeRootTabBarController.shared?.openWebPath(path) }) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .light))
                    .foregroundColor(gold)
                Text(title.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(2)
                    .foregroundColor(cream)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color.white.opacity(0.03))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.white.opacity(0.06)))
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var savedReportsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RECENT SAVED REPORTS")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(3)
                    .foregroundColor(muted)
                Spacer()
                if !savedReports.isEmpty {
                    Button("All") { NativeRootTabBarController.shared?.openWebPath("/saved-reports") }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(gold)
                }
            }
            if savedReports.isEmpty {
                emptyReportsCard
            } else {
                VStack(spacing: 8) {
                    ForEach(savedReports.prefix(4)) { r in
                        Button(action: { NativeRootTabBarController.shared?.openWebPath(r.reportUrl ?? "/report/\(r.id)") }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(r.address)
                                        .font(.system(size: 14, weight: .light, design: .serif))
                                        .foregroundColor(cream)
                                        .lineLimit(1)
                                    Text(formatSavedAt(r.savedAt))
                                        .font(.system(size: 10))
                                        .tracking(1)
                                        .foregroundColor(muted)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .regular))
                                    .foregroundColor(muted)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.white.opacity(0.03))
                            .overlay(RoundedRectangle(cornerRadius: 0).stroke(Color.white.opacity(0.06)))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
        }
    }

    private var emptyReportsCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "tray")
                .font(.system(size: 28, weight: .ultraLight))
                .foregroundColor(gold.opacity(0.6))
            Text("No saved reports yet")
                .font(.system(size: 14, weight: .light, design: .serif))
                .foregroundColor(cream)
            Text("Open any report — we'll keep it on this device so you can read it offline at a showing.")
                .font(.system(size: 12))
                .foregroundColor(muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
            Button(action: { NativeRootTabBarController.shared?.openWebPath("/analyze") }) {
                Text("ANALYZE A PROPERTY")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2)
                    .foregroundColor(.black)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(gold)
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .overlay(RoundedRectangle(cornerRadius: 0).stroke(Color.white.opacity(0.06)))
    }

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHY PROPERTYDNA")
                .font(.system(size: 9, weight: .medium))
                .tracking(3)
                .foregroundColor(muted)
            Text("Real estate agents have access to data you don't. We close that gap — automated valuations, comparable sales, climate risk, ownership history, market velocity. The intelligence that big institutional buyers use, in your hand.")
                .font(.system(size: 13))
                .foregroundColor(cream.opacity(0.7))
                .lineSpacing(4)
        }
        .padding(16)
        .background(Color.white.opacity(0.02))
    }

    private func refresh() {
        savedReports = SavedReportsStore.load()
    }

    private func formatSavedAt(_ d: Date) -> String {
        let diff = Date().timeIntervalSince(d)
        if diff < 60 { return "Just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        if diff < 86400 * 7 { return "\(Int(diff / 86400))d ago" }
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return f.string(from: d)
    }
}
