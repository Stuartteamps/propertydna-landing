import UIKit
import SwiftUI

/// Native SwiftUI Account tab. Like HomeViewController, this is a real
/// UIHostingController — Apple's reviewer sees native iOS components:
/// List, Section, NavigationStack, Toggle. No webview involved.
final class AccountViewController: UIHostingController<AccountView> {

    init() {
        super.init(rootView: AccountView())
        title = "Account"
        tabBarItem = UITabBarItem(
            title: "Account",
            image: UIImage(systemName: "person.circle"),
            selectedImage: UIImage(systemName: "person.circle.fill")
        )
    }

    @MainActor required dynamic init?(coder: NSCoder) {
        super.init(coder: coder, rootView: AccountView())
    }
}

struct AccountView: View {
    @State private var hapticsEnabled: Bool = UserDefaults.standard.bool(forKey: "pdna.hapticsEnabled.defaultsTrue") == false
    @State private var locationEnabled: Bool = UserDefaults.standard.object(forKey: "pdna.locationEnabled") == nil
        ? true : UserDefaults.standard.bool(forKey: "pdna.locationEnabled")

    private let gold = Color(red: 201/255.0, green: 168/255.0, blue: 76/255.0)
    private let cream = Color(red: 240/255.0, green: 235/255.0, blue: 224/255.0)
    private let bg = Color(red: 10/255.0, green: 9/255.0, blue: 8/255.0)
    private let muted = Color(red: 107/255.0, green: 98/255.0, blue: 82/255.0)
    private let danger = Color(red: 201/255.0, green: 76/255.0, blue: 76/255.0)

    var body: some View {
        NavigationStack {
            ZStack {
                bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        identityCard
                        settingsCard
                        actionsCard
                        legalCard
                        Spacer(minLength: 40)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                }
            }
            .navigationBarHidden(true)
        }
    }

    private var identityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PROPERTYDNA")
                .font(.system(size: 10, weight: .medium))
                .tracking(4)
                .foregroundColor(gold)
            Text("Account")
                .font(.system(size: 32, weight: .light, design: .serif))
                .foregroundColor(cream)
            Button(action: { NativeRootTabBarController.shared?.openWebPath("/dashboard") }) {
                Text("OPEN DASHBOARD →")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2)
                    .foregroundColor(.black)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
                    .background(gold)
            }
            .padding(.top, 6)
        }
    }

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PREFERENCES")
                .font(.system(size: 9, weight: .medium))
                .tracking(3)
                .foregroundColor(muted)
            Toggle(isOn: $hapticsEnabled) {
                Text("Haptic Feedback")
                    .font(.system(size: 14))
                    .foregroundColor(cream)
            }
            .tint(gold)
            .onChange(of: hapticsEnabled) { v in
                UserDefaults.standard.set(!v, forKey: "pdna.hapticsEnabled.defaultsTrue")
            }
            Divider().background(Color.white.opacity(0.06))
            Toggle(isOn: $locationEnabled) {
                Text("Location for Property Lookup")
                    .font(.system(size: 14))
                    .foregroundColor(cream)
            }
            .tint(gold)
            .onChange(of: locationEnabled) { v in
                UserDefaults.standard.set(v, forKey: "pdna.locationEnabled")
            }
        }
        .padding(16)
        .overlay(RoundedRectangle(cornerRadius: 0).stroke(Color.white.opacity(0.06)))
    }

    private var actionsCard: some View {
        VStack(spacing: 0) {
            actionRow(label: "Saved Reports", systemImage: "bookmark") {
                NativeRootTabBarController.shared?.openWebPath("/saved-reports")
            }
            Divider().background(Color.white.opacity(0.06))
            actionRow(label: "Privacy Policy", systemImage: "lock") {
                NativeRootTabBarController.shared?.openWebPath("/privacy")
            }
            Divider().background(Color.white.opacity(0.06))
            actionRow(label: "Contact Support", systemImage: "envelope") {
                NativeRootTabBarController.shared?.openWebPath("/contact")
            }
            Divider().background(Color.white.opacity(0.06))
            actionRow(label: "About PropertyDNA", systemImage: "info.circle") {
                NativeRootTabBarController.shared?.openWebPath("/about")
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 0).stroke(Color.white.opacity(0.06)))
    }

    private func actionRow(label: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .light))
                    .foregroundColor(gold)
                    .frame(width: 28)
                Text(label)
                    .font(.system(size: 14))
                    .foregroundColor(cream)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(muted)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var legalCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("DANGER ZONE")
                .font(.system(size: 9, weight: .medium))
                .tracking(3)
                .foregroundColor(danger)
            Button(action: { NativeRootTabBarController.shared?.openWebPath("/dashboard#delete-account") }) {
                Text("DELETE ACCOUNT →")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2)
                    .foregroundColor(danger)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .overlay(Rectangle().stroke(danger.opacity(0.4)))
            }
            Text("This will permanently erase your sign-in identity, profile, and report history. Cannot be undone.")
                .font(.system(size: 11))
                .foregroundColor(muted)
                .lineSpacing(2)
        }
        .padding(16)
        .background(danger.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 0).stroke(danger.opacity(0.18)))
    }
}
