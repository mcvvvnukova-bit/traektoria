import AppKit
import Foundation
import PDFKit
import Vision

if CommandLine.arguments.count < 2 {
  fputs("Usage: pdf_ocr.swift /absolute/path/to/file.pdf\n", stderr)
  exit(2)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: url) else {
  fputs("Cannot open PDF: \(CommandLine.arguments[1])\n", stderr)
  exit(1)
}

var pageTexts: [String] = []

for pageIndex in 0..<document.pageCount {
  autoreleasepool {
    guard let page = document.page(at: pageIndex) else {
      return
    }

    let bounds = page.bounds(for: .mediaBox)
    let scale = max(2.0, min(4.0, 2400.0 / max(bounds.width, 1)))
    let image = page.thumbnail(
      of: CGSize(width: bounds.width * scale, height: bounds.height * scale),
      for: .mediaBox
    )
    var rect = CGRect(origin: .zero, size: image.size)

    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
      return
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ru-RU", "en-US"]
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
    } catch {
      fputs("OCR failed on page \(pageIndex + 1): \(error)\n", stderr)
      return
    }

    let lines = (request.results ?? []).compactMap { observation in
      observation.topCandidates(1).first?.string
    }

    if !lines.isEmpty {
      pageTexts.append("--- PAGE \(pageIndex + 1) ---")
      pageTexts.append(contentsOf: lines)
    }
  }
}

print(pageTexts.joined(separator: "\n"))
