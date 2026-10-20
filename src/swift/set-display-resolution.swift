// set-display-resolution — set the built-in display's scaling.
// Compile: swiftc set-display-resolution.swift -o set-display-resolution
// Usage:   set-display-resolution            "More Space": the largest scaled HiDPI mode
//          set-display-resolution <w> <h>    a specific HiDPI mode
//          set-display-resolution --current  print the current mode
//          set-display-resolution --largest  print the "More Space" mode without applying it

import CoreGraphics
import Foundation

func builtinDisplay() -> CGDirectDisplayID {
    var count: UInt32 = 0
    CGGetOnlineDisplayList(0, nil, &count)
    var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
    CGGetOnlineDisplayList(count, &ids, &count)
    return ids.first(where: { CGDisplayIsBuiltin($0) != 0 }) ?? CGMainDisplayID()
}

let display = builtinDisplay()
let opts = [kCGDisplayShowDuplicateLowResolutionModes as String: true] as CFDictionary
guard let modes = CGDisplayCopyAllDisplayModes(display, opts) as? [CGDisplayMode] else {
    fputs("Error: could not list display modes\n", stderr)
    exit(1)
}

// True HiDPI modes render at 2x and are offered in System Settings
let hidpi = modes.filter { $0.pixelWidth == $0.width * 2 && $0.isUsableForDesktopGUI() }
let args = Array(CommandLine.arguments.dropFirst())

func describe(_ m: CGDisplayMode) -> String { "\(m.width)x\(m.height)" }

if args == ["--current"] {
    if let m = CGDisplayCopyDisplayMode(display) { print(describe(m)) }
    exit(0)
}

let target: CGDisplayMode?
if args.count == 2, let w = Int(args[0]), let h = Int(args[1]) {
    target = hidpi.first { $0.width == w && $0.height == h }
} else if args.isEmpty || args == ["--largest"] {
    target = hidpi.max { $0.width * $0.height < $1.width * $1.height }
} else {
    fputs("Usage: set-display-resolution [<width> <height> | --current | --largest]\n", stderr)
    exit(1)
}

guard let mode = target else {
    fputs("Error: no matching HiDPI mode. Available:\n", stderr)
    for m in Set(hidpi.map(describe)).sorted() { fputs("  \(m)\n", stderr) }
    exit(1)
}

if args == ["--largest"] {
    print(describe(mode))
    exit(0)
}

var config: CGDisplayConfigRef?
CGBeginDisplayConfiguration(&config)
CGConfigureDisplayWithDisplayMode(config, display, mode, nil)
if CGCompleteDisplayConfiguration(config, .permanently) == .success {
    print("Display set to \(describe(mode)) HiDPI")
} else {
    fputs("Error: could not apply \(describe(mode))\n", stderr)
    exit(1)
}
