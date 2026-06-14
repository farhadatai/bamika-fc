import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

// During local dev this plays from the MediaMTX server on this PC;
// in production it plays from the streaming VPS. Override with VITE_STREAM_URL.
const STREAM_URL =
  import.meta.env.VITE_STREAM_URL
  ?? (import.meta.env.DEV
    ? 'http://localhost:8888/live/cam/index.m3u8'
    : 'https://stream.bamikafc.com/live/cam/index.m3u8')

const RETRY_MS = 5000

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // React doesn't reliably write the `muted` attribute to the DOM, and
    // mobile browsers only allow autoplay when muted — set it explicitly.
    video.muted = true

    let hls: Hls | null = null
    let retryId: number | undefined
    let cancelled = false

    const goLive = () => {
      setIsLive(true)
      video.play().catch(() => {
        // Autoplay blocked — controls are visible and a tap anywhere plays.
      })
    }

    const retry = () => {
      setIsLive(false)
      retryId = window.setTimeout(start, RETRY_MS)
    }

    function start() {
      if (cancelled || !video) return

      // Prefer the native HLS player on Apple devices (iPhone/iPad/Safari).
      // Newer iOS Safari also passes Hls.isSupported(), but the native
      // player is far more reliable there, so check native support FIRST.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        const onReady = () => { cleanup(); goLive() }
        const onError = () => {
          cleanup()
          video.removeAttribute('src')
          video.load()
          retry()
        }
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onReady)
          video.removeEventListener('error', onError)
        }
        video.addEventListener('loadedmetadata', onReady)
        video.addEventListener('error', onError)
        video.src = STREAM_URL
        video.load()
      } else if (Hls.isSupported()) {
        hls = new Hls()
        hls.loadSource(STREAM_URL)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, goLive)
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls?.destroy()
            hls = null
            retry()
          }
        })
      }
    }

    start()

    return () => {
      cancelled = true
      window.clearTimeout(retryId)
      hls?.destroy()
    }
  }, [])

  // A tap anywhere on the player (including the offline overlay) counts as a
  // user gesture, which unblocks playback on phones that refused autoplay.
  const tapToPlay = () => {
    videoRef.current?.play().catch(() => {})
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl sm:text-4xl heading-bamika">
          Match <span className="text-[#D4AF37]">Live</span>
        </h1>
        {isLive && (
          <span className="bg-[#EF4444] text-white text-xs font-bold tracking-widest px-3 py-1 rounded-md animate-pulse">
            ● LIVE
          </span>
        )}
      </div>

      <div
        className="relative w-full aspect-video bg-neutral-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl"
        onClick={tapToPlay}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          className="h-full w-full"
        />
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-neutral-900 to-black text-center px-6 pointer-events-none">
            <img src="/logo.png" alt="Bamika FC" className="h-20 w-auto opacity-80" />
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gray-400" />
              </span>
              Waiting for broadcast
            </div>
            <h2 className="text-2xl heading-bamika">
              No match <span className="text-[#D4AF37]">live</span> right now
            </h2>
            <p className="text-gray-400 max-w-md">
              When Bamika FC goes live, the match starts playing here automatically &mdash;
              no need to refresh. Keep this page open, or check back at kickoff.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
