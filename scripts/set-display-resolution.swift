// set-display-resolution.swift
// Compile: swiftc set-display-resolution.swift -o set-display-resolution
// Usage:   set-display-resolution <width> <height>
// Example: set-display-resolution 1920 1200

import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 3,
      let targetW = Int(CommandLine.arguments[1]),
      let targetH = Int(CommandLine.arguments[2]) else {
    fputs("Usage: set-display-resolution <width> <height>\n", stderr)
    exit(1)
}

let display = CGMainDisplayID()

let opts: [String: Any] = [
    kCGDisplayShowDuplicateLowResolutionModes as String: true
]
guard let modes = CGDisplayCopyAllDisplayModes(display, opts as CFDictionary) as? [CGDisplayMode] else {
    fputs("Error: could not list display modes\n", stderr)
    exit(1)
}

// Find best HiDPI match: prefer pixelWidth == 2*width (true HiDPI), then any match
let candidates = modes.filter { $0.width == targetW && $0.height == targetH }
guard let best = candidates.first(where: { $0.pixelWidth == targetW * 2 }) ?? candidates.first else {
    fputs("Error: no mode found for \(targetW)x\(targetH)\n", stderr)
    fputs("Available HiDPI modes:\n", stderr)
    var seen = Set<String>()
    for m in modes where m.pixelWidth > m.width {
        let key = "\(m.width)x\(m.height)"
        if seen.insert(key).inserted {
            fputs("  \(m.width)x\(m.height) (pixels: \(m.pixelWidth)x\(m.pixelHeight))\n", stderr)
        }
    }
    exit(1)
}

var config: CGDisplayConfigRef?
CGBeginDisplayConfiguration(&config)
CGConfigureDisplayWithDisplayMode(config, display, best, nil)
let result = CGCompleteDisplayConfiguration(config, .permanently)

if result == .success {
    print("Display set to \(targetW)x\(targetH) HiDPI")
} else {
    fputs("Error: CGCompleteDisplayConfiguration failed (\(result.rawValue))\n", stderr)
    exit(1)
}
