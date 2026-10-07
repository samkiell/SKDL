import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

// Force Node.js runtime for FFmpeg usage
export const runtime = 'nodejs'

let ffmpegPath = ffmpegInstaller.path

console.info('[api/mux] module init... PATH:', process.env.PATH)
console.info('[api/mux] architecture:', os.arch(), 'platform:', os.platform())

// Optimize FFmpeg detection for server environments (Turbopack NFT trace safe)
if (typeof window === 'undefined') {
    try {
        // Check if 'ffmpeg' is directly available and working
        try {
            execSync('ffmpeg -version', { stdio: 'ignore' })
            ffmpegPath = 'ffmpeg'
            console.info('[api/mux] system ffmpeg is available and working via PATH')
        } catch (err) {
            // Fallback to searching with common absolute paths
            const commonPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/nix/var/nix/profiles/default/bin/ffmpeg']
            let found = false
            for (const p of commonPaths) {
                if (fs.existsSync(p)) {
                    ffmpegPath = p
                    found = true
                    console.info('[api/mux] found system ffmpeg at common path:', p)
                    break
                }
            }
            
            if (!found) {
                // Last resort: 'which'
                try {
                    const systemFfmpeg = execSync('which ffmpeg').toString().trim()
                    if (systemFfmpeg) {
                        ffmpegPath = systemFfmpeg
                        console.info('[api/mux] found system ffmpeg binary via which:', ffmpegPath)
                    } else {
                        throw new Error('not_found')
                    }
                } catch (e) {
                    throw new Error('not_found_on_system')
                }
            }
        }
    } catch (e) {
        console.info('[api/mux] fallback to installer binary:', ffmpegPath)
        // Ensure executable bit for installer binary if on linux
        if (os.platform() === 'linux') {
            try { 
                fs.chmodSync(ffmpegPath, 0o755) 
            } catch(e) {}
        }
    }
}

export async function GET(request: NextRequest) {
  return handleMuxRequest(request)
}

export async function POST(request: NextRequest) {
  return handleMuxRequest(request)
}

async function handleMuxRequest(request: NextRequest) {
  try {
    let videoUrl, subtitleUrl, filename
    if (request.method === 'GET') {
        const searchParams = request.nextUrl.searchParams
        videoUrl = searchParams.get('videoUrl')
        subtitleUrl = searchParams.get('subtitleUrl')
        filename = searchParams.get('filename')
    } else {
        const body = await request.json()
        videoUrl = body.videoUrl
        subtitleUrl = body.subtitleUrl
        filename = body.filename
    }

    if (!videoUrl || videoUrl === 'undefined' || videoUrl === 'null' || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const tmpDir = os.tmpdir()
    const subtitleFile = path.join(tmpDir, `subs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.srt`)

    // Helper to download subtitle with redirect support and validation
    const downloadSubtitle = async (url: string, dest: string) => {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://videodownloader.site/',
        'Origin': 'https://videodownloader.site',
        'Accept': '*/*',
      }
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (!res.ok) {
        throw new Error(`Failed to download subtitle: ${res.status}`)
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length < 10) {
        throw new Error('Subtitle file is empty or corrupted')
      }
      await fs.promises.writeFile(dest, buffer)
      return true
    }

    let hasLoadedSubs = false
    const hasSubs = subtitleUrl && subtitleUrl !== 'not_found' && subtitleUrl !== 'undefined' && subtitleUrl !== 'null'
    if (hasSubs) {
      try {
        await downloadSubtitle(subtitleUrl, subtitleFile)
        const stat = await fs.promises.stat(subtitleFile).catch(() => null)
        hasLoadedSubs = Boolean(stat && stat.size > 10)
      } catch (e) {
        console.warn('[api/mux] subtitle download failed, proceeding without subs:', e)
        try { if (fs.existsSync(subtitleFile)) fs.unlinkSync(subtitleFile) } catch (_) {}
        hasLoadedSubs = false
      }
    }

    // Build headers string for FFmpeg - Matching api/proxy exactly
    const ffHeaders = [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer: https://videodownloader.site/',
      'Origin: https://videodownloader.site',
      'Accept: */*',
      'Accept-Language: en-US,en;q=0.9',
      'Connection: keep-alive',
      'Sec-Fetch-Dest: video',
      'Sec-Fetch-Mode: no-cors',
      'Sec-Fetch-Site: cross-site',
      'Accept-Encoding: identity',
    ].join('\r\n') + '\r\n'

    console.info('[api/mux] preparing streaming mux with ffmpeg...', { video: videoUrl, hasSubs: hasLoadedSubs })

    // Build FFmpeg arguments
    const ffmpegArgs = [
      '-y',
      '-headers', ffHeaders,
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_on_http_error', '4xx,5xx',
      '-reconnect_delay_max', '10',
      '-probesize', '5M',
      '-analyzeduration', '5M',
      '-fflags', 'nobuffer',
      '-i', videoUrl,
    ]

    if (hasLoadedSubs) {
      ffmpegArgs.push('-i', subtitleFile)
    }

    ffmpegArgs.push(
      '-map', '0:v',
      '-map', '0:a?',
    )

    if (hasLoadedSubs) {
      ffmpegArgs.push(
        '-map', '1:s',
        '-c', 'copy',
        '-c:s', 'srt',
        '-metadata:s:s:0', 'language=eng'
      )
    } else {
      ffmpegArgs.push('-c', 'copy')
    }

    ffmpegArgs.push(
      '-f', 'matroska',
      'pipe:1'
    )

    // Helper fallback URL if FFmpeg fails or cannot stream
    const fallbackDirectUrl = `/api/proxy?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}.mkv&dl=1`

    // Attempt to spawn FFmpeg and wait for initial data chunk or immediate error
    let ffmpeg: any
    try {
      ffmpeg = spawn(ffmpegPath, ffmpegArgs)
    } catch (spawnErr) {
      console.error('[api/mux] FFmpeg failed to spawn, redirecting to direct stream:', spawnErr)
      if (hasLoadedSubs) {
        try { fs.unlinkSync(subtitleFile) } catch (_) {}
      }
      return NextResponse.redirect(new URL(fallbackDirectUrl, request.url))
    }

    let ffmpegLog = ''
    ffmpeg.stderr.on('data', (data: Buffer) => {
      ffmpegLog += data.toString()
    })

    ffmpeg.on('close', (code: number) => {
      if (hasLoadedSubs) {
        try { fs.unlinkSync(subtitleFile) } catch (_) {}
      }
    })

    // Wait for the first output chunk with a 6-second timeout before committing response headers
    const firstChunk = await new Promise<Buffer | null>((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }, 6000)

      const onData = (chunk: Buffer) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          ffmpeg.stdout.removeListener('data', onData)
          resolve(chunk)
        }
      }

      const onError = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(null)
        }
      }

      const onClose = (code: number) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(null)
        }
      }

      ffmpeg.stdout.on('data', onData)
      ffmpeg.on('error', onError)
      ffmpeg.on('close', onClose)
    })

    // If FFmpeg exited or timed out without producing any data, fall back immediately to direct proxy stream
    if (!firstChunk || firstChunk.length === 0) {
      console.warn('[api/mux] FFmpeg produced 0 bytes, failing over to direct proxy stream download')
      try { ffmpeg.kill('SIGKILL') } catch (_) {}
      if (hasLoadedSubs) {
        try { fs.unlinkSync(subtitleFile) } catch (_) {}
      }
      return NextResponse.redirect(new URL(fallbackDirectUrl, request.url))
    }

    // FFmpeg is working and has emitted valid data; stream it to the client
    const responseStream = new ReadableStream({
      start(controller) {
        controller.enqueue(firstChunk)

        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          try {
            controller.enqueue(chunk)
            if (controller.desiredSize !== null && controller.desiredSize <= 0) {
              ffmpeg.stdout.pause()
            }
          } catch (_) {
            ffmpeg.kill('SIGKILL')
          }
        })

        ffmpeg.stdout.on('end', () => {
          try { controller.close() } catch (_) {}
        })

        ffmpeg.on('error', (err: any) => {
          try { controller.error(err) } catch (_) {}
        })
      },
      pull() {
        ffmpeg.stdout.resume()
      },
      cancel() {
        ffmpeg.kill('SIGKILL')
      }
    })

    return new NextResponse(responseStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/x-matroska',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.mkv"`,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    })

  } catch (err: any) {
    console.error('Mux API caught error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
