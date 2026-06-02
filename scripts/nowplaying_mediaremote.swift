#!/usr/bin/env swift

import Foundation

typealias MRMediaRemoteGetNowPlayingInfoFunction = @convention(c) (DispatchQueue, @escaping (CFDictionary) -> Void) -> Void

guard let bundle = CFBundleCreate(kCFAllocatorDefault, NSURL(fileURLWithPath: "/System/Library/PrivateFrameworks/MediaRemote.framework")),
      let ptr = CFBundleGetFunctionPointerForName(bundle, "MRMediaRemoteGetNowPlayingInfo" as CFString) else {
    exit(1)
}

let MRMediaRemoteGetNowPlayingInfo = unsafeBitCast(ptr, to: MRMediaRemoteGetNowPlayingInfoFunction.self)

var done = false

// Must use DispatchQueue.main — the XPC callback requires the main RunLoop to be
// pumping. Using a global queue + DispatchGroup.wait blocks the main thread and
// the callback never fires in a compiled binary (works in swift interpreter which
// has an implicit RunLoop, but not in a standalone executable).
MRMediaRemoteGetNowPlayingInfo(DispatchQueue.main) { info in
    if let d = info as? [String: Any],
       let artist = d["kMRMediaRemoteNowPlayingInfoArtist"] as? String,
       let title  = d["kMRMediaRemoteNowPlayingInfoTitle"] as? String,
       let rate   = d["kMRMediaRemoteNowPlayingInfoPlaybackRate"] as? NSNumber,
       rate.doubleValue == 1.0 {
        print("\(artist) - \(title)")
    }
    done = true
}

// Pump the main RunLoop in small ticks until the callback fires or timeout.
let deadline = Date().addingTimeInterval(5)
while !done && Date() < deadline {
    RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.05))
}
