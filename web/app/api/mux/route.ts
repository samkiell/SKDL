import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

// Force Node.js runtime for FFmpeg usage
export const runtime = 'nodejs'

const ffmpegPath = ffmpegInstaller.path

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, subtitleUrl, filename } = await request.json()

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
        console.info('[api/mux] downloading subtitles...', { subs: subtitleUrl })
        try {
            await downloadFile(subtitleUrl, subtitleFile)
        } catch (e) {
            console.error('[api/mux] subtitle download failed, proceeding without subs:', e)
        }
    }
    
    // Build headers string for FFmpeg
    const ffHeaders = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer: https://fmoviesunblocked.net/',
        'Origin: https://h5.aoneroom.com',
    ].join('\r\n') + '\r\n'

    console.info('[api/mux] starting streaming mux with ffmpeg...', { video: videoUrl })

    // Run FFmpeg command - STREAM TO STDOUT
    const ffmpegArgs = [
        '-headers', ffHeaders,
        '-i', videoUrl,
    ]

    const hasLoadedSubs = hasSubs && fs.existsSync(subtitleFile)
    if (hasLoadedSubs) {
        ffmpegArgs.push('-i', subtitleFile)
    }

    ffmpegArgs.push(
        '-map', '0:v',    // Map first input video
        '-map', '0:a',    // Map first input audio
    )

    if (hasLoadedSubs) {
        ffmpegArgs.push(
            '-map', '1:s',    // Map second input (SRT) subtitle
            '-c', 'copy',     // Stream copy both video and audio
            '-c:s', 'srt',     // Subtitle codec
            '-metadata:s:s:0', 'language=eng'
        )
    } else {
        ffmpegArgs.push('-c', 'copy')
    }

    ffmpegArgs.push(
        '-y',             // Overwrite
        '-f', 'matroska', // Output format
        // Optimization for streaming Matroska
        '-reserve_index_space', '1024', 
        'pipe:1'          // Output to STDOUT
    )

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
            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error('[api/mux] ffmpeg failed with code', code)
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
