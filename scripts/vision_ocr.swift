import Foundation
import ImageIO
import Vision

struct OCRLine: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRPage: Codable {
    let file: String
    let lines: [OCRLine]
}

func recognize(path: String) throws -> OCRPage {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "VisionOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read image: \(path)"])
    }

    var rows: [OCRLine] = []
    let request = VNRecognizeTextRequest { request, _ in
        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            return
        }

        rows = observations.compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }

            let box = observation.boundingBox
            return OCRLine(
                text: candidate.string,
                confidence: candidate.confidence,
                x: box.origin.x,
                y: box.origin.y,
                width: box.size.width,
                height: box.size.height
            )
        }
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["ru-RU", "en-US", "zh-Hans"]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    return OCRPage(file: url.lastPathComponent, lines: rows)
}

let paths = Array(CommandLine.arguments.dropFirst())
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

var pages: [OCRPage] = []
for path in paths {
    do {
        let page = try recognize(path: path)
        pages.append(page)
    } catch {
        fputs("OCR error for \(path): \(error.localizedDescription)\n", stderr)
    }
}

let data = try encoder.encode(pages)
if let output = String(data: data, encoding: .utf8) {
    print(output)
}
