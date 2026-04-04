import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

// Force Node.js runtime for FFmpeg usage
export const runtime = 'nodejs'

let ffmpegPath = ffmpegInstaller.path

try {
    const { execSync } = require('child_process')
    const systemFfmpeg = execSync('which ffmpeg').toString().trim()
    if (systemFfmpeg) {
        ffmpegPath = systemFfmpeg
        console.info('[api/mux] using system ffmpeg binary:', ffmpegPath)
    }
} catch (e) {
    console.info('[api/mux] fallback to installer binary:', ffmpegPath)
    // Ensure executable bit for installer binary if on linux
    if (os.platform() === 'linux') {
        try { fs.chmodSync(ffmpegPath, 0o755) } catch(e) {}
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

    if (!videoUrl || !subtitleUrl || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const tmpDir = os.tmpdir()
    const subtitleFile = path.join(tmpDir, `subs_${Date.now()}.srt`)

    // Helper to download a file with spoofed headers to avoid 403s
    const downloadFile = (url: string, dest: string) => {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest)
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://fmoviesunblocked.net/',
                'Origin': 'https://h5.aoneroom.com',
                'Accept': '*/*',
            }

            https.get(url, { headers }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download subtitle: ${response.statusCode}`))
                    return
                }
                response.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve(true)
                })
            }).on('error', (err) => {
                fs.unlink(dest, () => {})
                reject(err)
            })
        })
    }

    const hasSubs = subtitleUrl && subtitleUrl !== 'not_found'
    if (hasSubs) {
        // console.info('[api/mux] downloading subtitles...', { subs: subtitleUrl }) // Log less verbose URL to avoid cluttering logs
        try {
            await downloadFile(subtitleUrl, subtitleFile)
        } catch (e) {
            console.error('[api/mux] subtitle download failed, proceeding without subs:', e)
        }
    }
    
    // Build headers string for FFmpeg - Matching api/proxy exactly
    const ffHeaders = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer: https://fmoviesunblocked.net/',
        'Origin: https://h5.aoneroom.com',
        'Accept: */*',
        'Accept-Language: en-US,en;q=0.9',
        'Connection: keep-alive',
        'Sec-Fetch-Dest: video',
        'Sec-Fetch-Mode: no-cors',
        'Sec-Fetch-Site: cross-site',
        'Accept-Encoding: identity',
        'Range: bytes=0-',
    ].join('\r\n') + '\r\n'

    console.info('[api/mux] starting streaming mux with ffmpeg...', { video: videoUrl })

    // Build FFmpeg command with reconnection logic for stability
    const ffmpegArgs = [
        '-headers', ffHeaders,
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_at_eof', '1',
        '-reconnect_delay_max', '4',
        '-i', videoUrl,
    ]

    const hasLoadedSubs = hasSubs && fs.existsSync(subtitleFile)
    if (hasLoadedSubs) {
        ffmpegArgs.push('-i', subtitleFile)
    }

    ffmpegArgs.push(
        '-map', '0:v',    // Map first input video
        '-map', '0:a?',    // Map first input audio (optional)
    )

    if (hasLoadedSubs) {
        ffmpegArgs.push(
            '-map', '1:s',    // Map second input (SRT) subtitle
            '-c', 'copy',     // Stream copy both video and audio
            '-c:s', 'srt',    // Subtitle codec
            '-metadata:s:s:0', 'language=eng'
        )
    } else {
        ffmpegArgs.push('-c', 'copy')
    }

    ffmpegArgs.push(
        '-y',             // Overwrite
        '-f', 'matroska', // Output format
        'pipe:1'          // Output to STDOUT
    )

    console.info('[api/mux] spawning ffmpeg:', { path: ffmpegPath, argsLength: ffmpegArgs.length })
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs)

    // We use a Readable Stream to wrap the FFmpeg stdout
    const stream = new ReadableStream({
        start(controller) {
            ffmpeg.stdout.on('data', (chunk) => {
                controller.enqueue(chunk)
            })
            ffmpeg.stderr.on('data', (data) => {
                const msg = data.toString()
                if (msg.includes('bitrate=') || msg.includes('frames=')) {
                    // console.log(`[ffmpeg]: ${msg.trim()}`) // Keep log quiet to avoid Vercel log limits
                }
            })
            ffmpeg.on('close', (code, signal) => {
                if (code !== 0) {
                    console.error(`[api/mux] ffmpeg failed with code ${code} and signal ${signal}`)
                }
                // Cleanup subtitle temp file
                if (hasLoadedSubs) {
                    try { fs.unlinkSync(subtitleFile) } catch(e) {}
                }
                controller.close()
            })
            ffmpeg.on('error', (err) => {
                console.error('[api/mux] ffmpeg spawn error:', err)
                controller.error(err)
            })
        },
        cancel() {
            ffmpeg.kill()
        }
    })

    return new NextResponse(stream, {
        status: 200,
        headers: {
            'Content-Type': 'video/x-matroska',
            'Content-Disposition': `attachment; filename="${filename}.mkv"`,
            // We cannot provide Content-Length when streaming dynamic output
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        },
    })

  } catch (err: any) {
    console.error('Mux API caught error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
