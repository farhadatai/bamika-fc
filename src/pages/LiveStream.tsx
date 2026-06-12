import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

// During local dev this plays from the MediaMTX server on this PC;
// in production it plays from the streaming VPS. Override with VITE_STREAM_URL.
const STREAM_URL =
  import.meta.env.VITE_STREAM_URL
  ?? (import.meta.env.DEV
    ? 'http://localhost:8888/live/index.m3u8'
    : 'https://stream.bamikafc.com/live/index.m3u8')

const RETRY_MS = 5000

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    let retryId: number | undefined
    let cancelled = false

    const retry = () => {
      setIsLive(false)
      retryId = window.setTimeout(start, RETRY_MS)
    }

    function start() {
      if (cancelled || !video) return

      if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true })
        hls.loadSource(STREAM_URL)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLive(true)
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls?.destroy()
            hls = null
            retry()
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari / iOS play HLS natively
        video.src = STREAM_URL
        video.addEventListener('loadedmetadata', () => {
          setIsLive(true)
          video.play().catch(() => {})
        }, { once: true })
        video.addEventListener('error', () => {
          video.removeAttribute('src')
          video.load()
          retry()
        }, { once: true })
      }
    }

    start()

    return () => {
      cancelled = true
      window.clearTimeout(retryId)
      hls?.destroy()
    }
  }, [])

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

      <div className="relative w-full aspect-video bg-neutral-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
        <video
          ref={videoRef}
          controls
          muted
          playsInline
          className="h-full w-full"
        />
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-neutral-900 to-black text-center px-6">
            <img src="/logo.png" alt="Bamika FC" className="h-20 w-auto opacity-80" />
            <h2 className="text-2xl heading-bamika">
              Stream is <span className="text-[#D4AF37]">offline</span>
            </h2>
            <p className="text-gray-400 max-w-md">
              The broadcast hasn&apos;t started yet. Keep this page open &mdash; the
              match will start playing automatically as soon as we go live.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
