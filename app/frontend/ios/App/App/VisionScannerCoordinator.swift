import UIKit
import AVFoundation
import Vision
import WebKit

/// Bridges `window.webkit.messageHandlers.pdnaScanAddress.postMessage(...)`
/// to a native AVCaptureSession + Vision text-recognition pipeline. When the
/// user taps "Scan Address" on the Analyze form, this presents a full-screen
/// native camera with a yellow targeting reticle. The Vision framework runs
/// VNRecognizeTextRequest on every frame *entirely on-device* — no network,
/// no third-party SDK. Detected lines that look like a U.S. street address
/// are returned to JS via `evaluateJavaScript`.
final class VisionScannerCoordinator: NSObject, WKScriptMessageHandler {

    private weak var presenter: UIViewController?
    private weak var webView: WKWebView?

    init(presenter: UIViewController, webView: WKWebView) {
        self.presenter = presenter
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        let callbackId = (body["callbackId"] as? String) ?? ""
        DispatchQueue.main.async { [weak self] in
            self?.presentScanner(callbackId: callbackId)
        }
    }

    private func presentScanner(callbackId: String) {
        let vc = VisionScannerViewController()
        vc.modalPresentationStyle = .fullScreen
        vc.onRecognized = { [weak self] text in
            self?.deliver(callbackId: callbackId, address: text)
            vc.dismiss(animated: true)
        }
        vc.onCancel = { [weak self] in
            self?.deliver(callbackId: callbackId, address: nil)
            vc.dismiss(animated: true)
        }
        presenter?.present(vc, animated: true)
    }

    private func deliver(callbackId: String, address: String?) {
        let payload: [String: Any] = [
            "callbackId": callbackId,
            "address": address as Any
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.dispatchEvent(new CustomEvent('pdnaScanAddressResult', { detail: \(json) }))"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

/// The actual camera view controller. AVCaptureVideoDataOutput pipes frames
/// into a Vision text-recognition request running on a background queue.
/// Recognized strings are scored against a simple U.S. address heuristic:
/// must start with 1-6 digits followed by a street word.
final class VisionScannerViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate {

    var onRecognized: ((String) -> Void)?
    var onCancel: (() -> Void)?

    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.thepropertydna.scanner.video")
    private let textRequest: VNRecognizeTextRequest = {
        let r = VNRecognizeTextRequest()
        r.recognitionLevel = .accurate
        r.usesLanguageCorrection = true
        return r
    }()

    private let preview = UIView()
    private let reticle = UIView()
    private let label = UILabel()
    private var captured = false

    // Crude but effective: 1-6 leading digits + space + at least one street word.
    private let addressPattern: NSRegularExpression = {
        let pattern = #"^\d{1,6}\s+[A-Za-z0-9.\-\s]{3,80}(?:\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Ter|Terrace|Cir|Circle|Hwy|Highway))\.?\b"#
        return try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        preview.frame = view.bounds
        preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(preview)

        setupSession()

        // Targeting reticle
        let reticleSize: CGFloat = min(view.bounds.width - 48, 320)
        reticle.frame = CGRect(x: 0, y: 0, width: reticleSize, height: reticleSize * 0.45)
        reticle.center = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        reticle.layer.borderColor = UIColor(red: 201/255.0, green: 168/255.0, blue: 76/255.0, alpha: 1.0).cgColor
        reticle.layer.borderWidth = 2.0
        reticle.layer.cornerRadius = 4
        reticle.isUserInteractionEnabled = false
        view.addSubview(reticle)

        // Instruction label
        label.text = "Center the street address inside the box"
        label.textColor = UIColor.white
        label.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.frame = CGRect(x: 24, y: reticle.frame.maxY + 24, width: view.bounds.width - 48, height: 40)
        view.addSubview(label)

        // Cancel button
        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.white, for: .normal)
        cancel.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        cancel.frame = CGRect(x: 16, y: view.safeAreaInsets.top + 12, width: 80, height: 40)
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(cancel)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        queue.async { [weak self] in self?.session.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        queue.async { [weak self] in self?.session.stopRunning() }
    }

    @objc private func cancelTapped() { onCancel?() }

    private func setupSession() {
        session.sessionPreset = .high
        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let input = try? AVCaptureDeviceInput(device: device)
        else {
            label.text = "Camera unavailable on this device."
            return
        }
        if session.canAddInput(input) { session.addInput(input) }

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        if session.canAddOutput(output) { session.addOutput(output) }

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.frame = preview.bounds
        layer.videoGravity = .resizeAspectFill
        preview.layer.addSublayer(layer)
    }

    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard !captured, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right)
        do {
            try handler.perform([textRequest])
        } catch { return }

        guard let results = textRequest.results else { return }
        for obs in results {
            guard let candidate = obs.topCandidates(1).first else { continue }
            let s = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            let range = NSRange(s.startIndex..., in: s)
            if addressPattern.firstMatch(in: s, range: range) != nil {
                captured = true
                let recognized = s
                DispatchQueue.main.async { [weak self] in
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    self?.onRecognized?(recognized)
                }
                return
            }
        }
    }
}
